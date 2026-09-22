---
title: "Reverse engineering MIBSI: Inside the Virtual Cockpit integration"
description: "Bringing phone navigation into Audi’s Virtual Cockpit: the native hooks, video pipeline, navigation bridge, and display coordination behind the integration."
date: "2026-09-22"
tags: [Reverse engineering, QNX, Automotive]
draft: false
---

## Two paths, one cluster

Android Auto / CarPlay — Firmware-specific native integration

| Path | Input | Processing | Output |
| --- | --- | --- | --- |
| 01 / VIDEO | Encoded map frames | Hardware decoder | Projected map surface |
| 02 / GUIDANCE | Navigation snapshots | Java navigation bridge | Cluster messages + turn cards |

**Display coordination:** Ownership · geometry · readiness · OEM restoration

*Fig. 01 / Two paths, one cluster Reconstructed from the supplied release*

*Native libraries carry the streams and navigation data. Java coordinates presentation with the existing HMI.*

*Conceptual architecture. The map video and semantic turn guidance travel through different paths before meeting in the cluster.*

MIBSI brings a phone-driven map and navigation guidance into Audi’s instrument cluster. It connects Android Auto and CarPlay to the car’s existing navigation and graphics services.

The integration spans native ARM code, a legacy Java HMI, hardware video decoding, and a custom turn-card renderer. An SD-card installer deploys these components and keeps backups for recovery. The difficult work lies in synchronizing their state during display changes and phone disconnects.

> **Reconstructed development sequence** The release contains binaries, scripts, and recovered code. Without the original source-control history, the chapter order follows implementation dependencies rather than a documented development timeline.

## Hook into the projection processes and Java HMI.

The installation scripts target a QNX environment with MMX and RCC nodes, mounted application and system partitions, and a Java HMI launched through J9. The update script forwards some operations to MMX, depending on which node runs it.

The package supplies modified `gal` and `dio_manager` executables that reference the Android Auto and CarPlay integration libraries. The Java launch script prepends the supplied JARs to the boot classpath. Those archives contain custom bridge classes alongside classes in existing OEM namespaces.

`TerminalModeBapCombi` connects projection activation and deactivation to the bridge inside the existing HMI. Other adapted classes intercept navigation-service, map-control, and cluster-display operations.

The installer verifies exact hashes of `lsd.jxe`, `libautoreceiver.so`, and `libairplay.so` before modifying the system. These dependencies stay in place: the hooks require their exact binary interfaces. The hash checks make compatibility specific to firmware binaries, beyond the product name.

## Negotiate cluster content with each phone platform.

Android Auto and CarPlay use separate native integration paths to supply content to the cluster.

The Android Auto library references service registration, protocol-message serialization, video focus, frame acknowledgment, and navigation-message routing. It names stock and cluster service-description captures. These references suggest integration around protocol endpoints and the capabilities announced to the phone.

The CarPlay library references additional displays, an `altScreen`, view areas, screen-session setup and teardown, keyframe requests, and an instrument-cluster Maps URL. References to iAP2 messages and a route-guidance display component identify its navigation-data path.

The map arrives as video. Maneuvers, distances, and road names arrive as structured navigation data. MIBSI processes these through separate paths so it can coordinate the phone’s map with the cluster’s guidance display.

> **Native-code evidence** Recovered code, imported symbols, and embedded strings support this architecture. They leave details of the proprietary protocol exchanges unresolved.

## Synchronize the decoder after a connection.

A viewer that joins midstream can receive frames that depend on pictures it missed. It can lack codec configuration, too. The decoder needs both that configuration and a usable reference picture before it can produce the image.

The native libraries wait for codec configuration and a complete IDR access unit, a picture the decoder can process without earlier frames. They provide keyframe or focus-recovery mechanisms to regain synchronization after reconnection.

A slow consumer can fill the stream writer’s bounded queue. The native diagnostics record oversized access units and describe marking a discontinuity after queue saturation. That marker allows recovery from a gap in the stream.

The receiving helper, `mhi2q-aa-cluster-display`, references OpenMAX calls and a Qualcomm AVC decoder. Its symbols include tiled NV12 crop and fill operations. Its strings identify buffer dimensions and stride, plus a direct decoder-to-Screen recovery path. These constrain how decoded pixels reach the display: buffer layout must match the hardware and graphics APIs.

1. **CONNECT** Establish the local stream and obtain codec configuration.
2. **SYNCHRONIZE** Wait for a complete keyframe before accepting a decoding baseline.
3. **PRESENT** Decode into the display path; recover when continuity is lost.

## Translate navigation records into cluster guidance.

The native integrations write navigation state to separate temporary files for Android Auto and CarPlay. `NavigationStateReader` selects the active projection and parses its records into a shared snapshot model.

The reader supports three record versions; later formats add destination distance and time, then lane guidance. It decodes hex-encoded text as UTF-8 and validates lane counts, direction counts, and selected directions.

The reader polls every 250 milliseconds. Its freshness check rejects inactive data, unsupported projection modes, future timestamps, and records older than three seconds. Switching projection clears the snapshot to discard guidance from the previous source.

`ManeuverMapper` translates maneuver identifiers and roundabout information into OEM cluster descriptors and custom-renderer instructions. `Mhi2qAaNavProxy` publishes navigation through the cluster’s BAP service using the OEM distance formatter. Both presentation paths use the same navigation snapshot.

For non-highway maneuvers, the policy opens a turn card within 450 meters or 35 seconds. An open card stays eligible within 560 meters or 45 seconds. Highway maneuvers use wider thresholds. This hysteresis reduces open-close transitions as estimates fluctuate near a boundary.

*RECOVERED POLICY / Simplified non-highway threshold selection*

```text
openDistance = alreadyOpen ? 560 : 450;  // meters
openTime     = alreadyOpen ? 45  : 35;   // seconds

show = validTimeWithin(openTime)
    || validDistanceWithin(openDistance);
```

Explanatory pseudocode. The actual policy also handles highway and special maneuver cases.

## Coordinate frame readiness with display ownership.

Before showing a card, MIBSI needs a valid renderer frame, the correct cluster context, and matching layer geometry. It must suppress competing OEM guidance updates for the duration of the projected session.

`RendererServer` tracks connection readiness, frame readiness, and frame clearing. It exchanges fixed 48-byte packets over loopback, using separate reader and writer threads and a 32-entry write queue. Each connection increments a generation counter and clears queued work. The writer rejects packets from older connections.

The navigation proxy tracks renderer revisions and presentation tokens. On reconnection, it invalidates the rendered sequence and token, then republishes current state. The composition layer checks revisions and tokens before applying visibility and notifying the renderer.

*Fig. 02 / A coordinated presentation*

1. **1 / DRAW** The bridge sends a maneuver snapshot to the native renderer.
2. **2 / CONFIRM** The renderer reports that a frame is ready.
3. **3 / APPLY** Composition applies visibility and geometry for the current request.

*Presentation feedback returns to the bridge and renderer. Connection generations, revisions, and tokens track different parts of the lifecycle.*

`BridgeVehicleConfig` defines the projection context, turn-card and backing displayables, and geometry for large, classic-small, and sport-small views. The configuration includes a 328 × 180 source area and a 210 × 153 crop. A view change requires matching the source region to its destination and backing layer.

`Mhi2qAaClusterComposition` compares requested presentation with observed display state in a worker loop. After context drift, it asks the native helper to reassert the projection context. It reapplies geometry after a view, skin, or revision change.

`Mhi2qAaGatedCombiService` suppresses OEM guidance updates while passing unrelated calls through. `OemClusterMapRenderGate` controls OEM map rendering and records the visibility to restore. The two gates cover separate resources: navigation messages and the map image.

## Restore OEM state after projection ends.

A phone disconnect, renderer reconnection, switch to the OEM map, or context change can interrupt pending display work. MIBSI needs recovery paths for each transition.

The navigation proxy implements session-stop, startup-rollback, and fail-open paths. During teardown it clears published guidance, restores the remembered OEM route-guidance state, requests renderer clearing, hides the custom card, and releases the BAP gate. It requests an OEM state replay and retries if that fails.

The map-render gate records the visibility requested by the OEM while holding its map hidden. On release, it uses the navigation dispatcher to restore that requested state. The restored map can therefore remain hidden if that was the OEM’s last request.

The settings menu lets the driver choose projected content or the OEM map. The HMI storage service persists that choice with retry handling. Before activation, the Java layer runs a native authorization check in a background worker and retains the requested projection until the runtime is ready.

## Make a firmware change recoverable.

The SD bundle contains OEM update metadata, a bootstrap, menu scripts, a product payload, and a native lifecycle tool. The bootstrap stages the engineering-menu entry under an inert extension. It publishes the entry after copying the scripts the menu needs.

The product installer checks firmware identity, dependency hashes, payload integrity, and operation markers before remounting the application and system partitions for writing. It delegates the transaction to `mibsi-install-tool`, synchronizes writes, and attempts to restore read-only mounts.

The native tool’s records and diagnostics identify backup manifests, staged-file and final readback, an installer lock, and a pending journal. Recovery messages describe resuming interrupted work before a new operation and retaining the journal after incomplete rollback.

The installer comments specify backups of file bytes, permissions, ownership, symlink targets, and absent paths. Restoration can mean putting back an existing modified file, recreating a link, or removing a file that the installation added.

*The installation lifecycle exposed by the package*

| Stage | Engineering purpose |
| --- | --- |
| Identify and verify | Reject incompatible dependencies or an altered payload before writable product mounts. |
| Capture the prior state | Preserve the prior installation, including modified files and missing paths. |
| Stage and publish | Check staged bytes and the resulting installed files. |
| Recover or roll back | Use persistent transaction state to handle interrupted work and incomplete restoration. |

## Evidence and verification limits.

The available evidence includes original scripts and configuration, two Java decompiler outputs, bytecode listings, and Ghidra exports of seven native ARM files. The Java reconstruction exposes the state machines. Native symbols and diagnostics connect the phone-facing libraries to the decoder and renderer.

The recovery report records 187,284 matching comparisons between original and recovered versions of `ManeuverMapper` and `TurnCardPolicy`. These checks cover two calculation classes. They provide no whole-system or on-vehicle verification of the native code or asynchronous display behavior.

The bundle lacks the original build sources, complete OEM dependencies, and development timeline. Confirming the reconstruction would require those dependencies and runtime tests of decoding, display transitions, and recovery on the target firmware.

## Source trail

Complete source files are embedded below; each link opens its corresponding appendix entry.

- [Recovery report](#source-01) : inventory, reconstruction methods, verification, and limitations.
- [HMI launch script](#source-02) and [projection lifecycle integration](#source-03) : native environment and Java entry points.
- [Android Auto native evidence](#source-04) and [CarPlay native evidence](#source-05) : projection, navigation, and stream synchronization.
- [Decoder/display helper evidence](#source-06) : hardware decoding and the display path.
- [Navigation reader](#source-07) , [maneuver mapper](#source-08) , and [turn-card policy](#source-09) : data, meaning, and timing.
- [Navigation coordinator](#source-10) and [renderer transport](#source-11) : presentation and recovery state.
- [Cluster composition](#source-12) , [vehicle geometry](#source-13) , and [OEM map gate](#source-14) : display ownership and restoration.
- [Bootstrap](#source-15) , [product installer](#source-16) , and [native lifecycle evidence](#source-17) : staging, compatibility checks, and recovery.
- [Preserved Java attribution](#source-18) : inherited-code credit retained in the bundle.

## Source appendix

### Source 01: Recovery report

Original path: `reverse-engineered/README.md`

<details id="source-01">
<summary>Read complete source</summary>

<!-- source-file: reverse-engineered/README.md; terminal-newline: yes -->

````markdown
# MIBSI recovered code

This is an automated reverse-engineering output for release `7e792409480209467f17fb27`, labelled `MHI2Q_ER_AUG22_P5092_MU1329`. It contains reconstructed code, not the exact original development sources. The input package has been preserved unchanged.

## Start reading here

The recommended Java reconstruction is in **[java-vineflower](java-vineflower/)**. These files retain original class, field and method names where the class files retained them. Local names such as `var0` were generated by the decompiler; no Java class has a local-variable table.

| Recovered file | What it exposes |
| --- | --- |
| [TurnCardPolicy.java](java-vineflower/com/nicolas/carplay/rgd/TurnCardPolicy.java) | Distance/time thresholds for showing navigation turn cards. A compact starting example. |
| [ManeuverMapper.java](java-vineflower/com/nicolas/carplay/aa/ManeuverMapper.java) | Maps maneuver identifiers to cluster descriptors and renderer instructions. |
| [NavigationStateReader.java](java-vineflower/com/nicolas/carplay/aa/NavigationStateReader.java) | Reads Android Auto and CarPlay navigation state files and chooses the active projection. |
| [Mhi2qAaNavProxy.java](java-vineflower/com/nicolas/carplay/rgd/Mhi2qAaNavProxy.java) | Coordinates navigation data, turn cards, cluster settings and OEM navigation integration. |
| [RendererServer.java](java-vineflower/com/nicolas/carplay/rgd/RendererServer.java) | Renderer transport and connection handling. |
| [Mhi2qAaClusterComposition.java](java-vineflower/com/nicolas/carplay/core/Mhi2qAaClusterComposition.java) | Cluster display ownership, layout, cropping and visibility. |
| [BridgeVehicleConfig.java](java-vineflower/com/nicolas/carplay/generated/BridgeVehicleConfig.java) | Compiled target identifiers, display contexts and layout constants. |
| [CarPlaySteeringMenuInput.java](java-vineflower/com/nicolas/carplay/core/CarPlaySteeringMenuInput.java) | Steering input handling for the cluster menu. |

The `de.audi`, `de.esolutions` and `org.dsi` packages also contain classes embedded in the supplied JAR. External firmware dependencies are not included in the package.

## Recovery coverage

45 Java class files represent 24 top-level classes plus inner/anonymous classes. Vineflower produced 34 Java files, retaining some anonymous classes in separate files; CFR produced 24 Java files with inner/anonymous classes folded into their enclosing classes. Both independent decompiler outputs are retained:

- `java-vineflower/`: recommended reading copy, generated with Vineflower 1.12.0.
- `java/`: raw CFR 0.152 output for comparison.
- `java-bytecode/`: `javap -c -p -s` disassembly of every original class, for checking disputed reconstruction.
- `java-resources/`: original manifests and attribution notice. The safe-boot JAR has **zero class files**, so it has no implementation to decompile.
- `original-text/`: byte-for-byte copies of the package's scripts, configuration and documentation. These were already source text.

Seven native files are 32-bit little-endian ARM ELF binaries. Ghidra 12.1.3 exported C-like pseudocode for 6,734 discovered functions; 0 discovered functions failed export. Synthetic external/uninitialized placeholders are excluded. Counts still include import trampolines, compiler scaffolding and other code detected by Ghidra, not just application logic.

| Native input / reconstructed C-like file | Functions exported | Failed |
| --- | ---: | ---: |
| [dio_manager.mhi2q_carplay_loader](native/dio_manager.mhi2q_carplay_loader.c) | 1,958 | 0 |
| [gal.mhi2q_aa_cluster_loader](native/gal.mhi2q_aa_cluster_loader.c) | 3,887 | 0 |
| [libmhi2qaacluster.so](native/libmhi2qaacluster.so.c) | 163 | 0 |
| [libmhi2qcarplaycluster.so](native/libmhi2qcarplaycluster.so.c) | 133 | 0 |
| [mhi2q-aa-cluster-display](native/mhi2q-aa-cluster-display.c) | 115 | 0 |
| [mhi2q-aa-turn-card-renderer](native/mhi2q-aa-turn-card-renderer.c) | 366 | 0 |
| [mibsi-install-tool](native/mibsi-install-tool.c) | 112 | 0 |

Every function in the C-like files has its binary address above it. The adjacent `.functions.tsv` files provide searchable indexes. `inventory/` contains the original ELF headers, sections, dynamic symbols, dependencies and strings with file offsets. `ghidra-project/MIBSI.gpr` retains the analysis database locally for further inspection; the portable ZIP excludes the database and tools.

## What the code shows

The recovered Java reads `/tmp/mhi2q_aa_nav_proxy.state` and `/tmp/mhi2q_carplay_nav_proxy.state`, translates maneuvers, coordinates the cluster navigation service and controls card presentation. Layout constants describe classic, sport and large-display arrangements. The native libraries contain matching state-file paths and references to the cluster-display and turn-card-renderer programs.

The supplied installer controls a firmware-specific transaction. It verifies expected dependencies and delegates installation/restoration to `mibsi-install-tool`. Native strings expose the managed paths, including the Android Auto loader `gal`, the CarPlay loader `dio_manager`, Java bootstrap archives and menu scripts. This is a code-reading result, not an on-vehicle behavior test.

## Fidelity and limitations

- Native binaries have no embedded DWARF debug sections or static symbol tables. Some loader metadata refers to external `.debug` files that are not supplied. Original C/C++ local names, source-file organization, comments, macros and many types cannot be restored from this bundle alone.
- Native `.c` files are **pseudocode, not build-ready C/C++**. Ghidra reports inferred/unknown calling conventions, unavailable firmware libraries, and some unsupported runtime-copy relocations. Successful export does not prove that every instruction was recognized or reconstructed correctly.
- Java comments, formatting and local variable names are not recoverable. The JAR preserves enough names to make much of its logic readable.
- Anonymous-class reconstruction differs between the decompilers. Some Vineflower files retain synthetic names such as `RendererServer$1` and `access$000` while hiding synthetic declarations. Consult CFR and the original bytecode for these cases; the raw Java output is not asserted to compile as a whole.
- CFR produces a visibly suspect uninitialized variable in `TurnCardPolicy.shouldOpen`; its untouched output is retained for comparison. Vineflower handles that case correctly in the targeted verification below.
- Vineflower warns that `de/audi/kbd/dsi/KbdListener$VolumeLongPressTimer` is missing. That class is absent from the supplied archive and cannot be recovered here.
- OEM APIs and libraries are absent, so the complete reconstructed project has not been rebuilt. Reconstructing code is not a guarantee of identical runtime behavior or a ready-to-install replacement.

## Verification performed

All 34 original package files still match the SHA-256 values captured before recovery. Each supplied Java class has a reference bytecode export, all top-level Java classes have both decompiler outputs, and every native export index agrees with its function count.

The recovered Vineflower `ManeuverMapper` and `TurnCardPolicy` compiled successfully. A differential check loaded the original and recovered classes separately and compared results across maneuver values, angles, threshold boundaries, boolean combinations and seeded random integer inputs:

```
PASS: 187284 original/recovered result comparisons across ManeuverMapper and TurnCardPolicy.
Scope: two pure computation classes only; not a whole-program or hardware verification.
```

This verifies two pure calculation classes only. It does not verify native pseudocode, the entire Java application, concurrency or operation on an MMI.

## Reproduction and tool provenance

Scripts used are in `scripts/`: `inventory.py`, `run-native.ps1`, `ExportRecoveredCode.java`, `verify_java.py`, `CompareRecoveredJava.java` and `package_recovery.py`. The initial inventory is a baseline snapshot; retain it if checking later input changes. Logs are in `logs/`. Use `run-native.ps1 -Reprocess` to re-export the existing Ghidra project without repeating analysis; a new import requires a fresh project name.

Official tool sources:

- [CFR 0.152](https://www.benf.org/other/cfr/)
- [Vineflower 1.12.0](https://github.com/Vineflower/vineflower/releases/tag/1.12.0)
- [Ghidra 12.1.3](https://github.com/NationalSecurityAgency/ghidra/releases/tag/Ghidra_12.1.3_build)
- [Eclipse Temurin JDK 25](https://github.com/adoptium/temurin25-binaries/releases/tag/jdk-25.0.4.1%2B1)

JDK, Ghidra and Vineflower downloads were checked against their publishers' SHA-256 digests. The original Java attribution notice is preserved under `java-resources/mhi2q-aa-navigation-proxy/META-INF/NOTICE.txt`.
````

</details>

### Source 02: HMI launch script

Original path: `Bootstrap/final/product/files/lsd.sh`

<details id="source-02">
<summary>Read complete source</summary>

<!-- source-file: Bootstrap/final/product/files/lsd.sh; terminal-newline: yes -->

```sh
#!/bin/sh

##
## Path setup:
##

# Note: The HMI expects certain directories below this base path. If you change this,
# you may need to change the paths declared in atip.properties (contained in lsd.jxe)
# also. This can be achieved without changing the property file by supplying the paths
# via -D command line options to the JVM.
# See section "Manually set path..." for an example.
export MOUNT_DIR=
export MOUNT_APP_DIR=/mnt/app
export BASE_DIR=$MOUNT_APP_DIR/eso/hmi
export LSD_DIR=$MOUNT_DIR/ifs
export GRAPHICS_DIR=$BASE_DIR/graphics
DEV_ACTIVATED=$BASE_DIR/lsd/development_activated

# Java home:
export JAVA_HOME=$MOUNT_DIR/ifs/jre
if [[ -f $DEV_ACTIVATED ]]; then
	if [[ -d $BASE_DIR/lsd/jre ]]; then
		export JAVA_HOME=$BASE_DIR/lsd/jre
	fi
fi

#export PATH=$JAVA_HOME/bin:$PATH
#export J9="on -C 0 $JAVA_HOME/bin/j9"
export J9="on -p 12 $JAVA_HOME/bin/j9"

## hybrid lib setup
export LIBIMG_CFGFILE=$GRAPHICS_DIR/img.conf

##
## JVM general setup:
##

## Setup library paths for Java generally, J9 and system:
LD_LIBRARY_PATH=.:$GRAPHICS_DIR:$MOUNT_DIR/root/lib-target:$JAVA_HOME/bin:$BASE_DIR/lsd:$MOUNT_DIR/armle/lib:$MOUNT_DIR/armle/lib/dll:$MOUNT_DIR/armle/usr/lib:$MOUNT_DIR/eso/lib:/navigation:/navigation/lib:$MOUNT_DIR/armle/graphics

## setup the JVM direct buffer guard size to enable GUARD checking
#export JVM_DIRECT_BUFFER_GUARD_SIZE=2

#enable micro jit
VMOPTIONS="$VMOPTIONS -Xmjit:code=2000,singleCache"
VMOPTIONS="$VMOPTIONS -Xquickstart"
VMOPTIONS="$VMOPTIONS -noverify"

#Compact on every call to System.gc().
VMOPTIONS="$VMOPTIONS -Xcompactexplicitgc"

# needed for -Xmn<size>:Sets the initial and maximum size of the new (nursery) heap to the specified value when using -Xgcpolicy:gencon
VMOPTIONS="$VMOPTIONS -Xgcpolicy:gencon"
VMOPTIONS="$VMOPTIONS -Xssi4K -Xss512K"
#VMOPTIONS="$VMOPTIONS -verbose:stack"
#VMOPTIONS="$VMOPTIONS -verbose:sizes"
#VMOPTIONS="$VMOPTIONS -verbose:dynload"

VMOPTIONS="$VMOPTIONS -Djava.library.path=$LD_LIBRARY_PATH"
VMOPTIONS="$VMOPTIONS -Dcom.ibm.oti.vm.bootstrap.library.path=$LD_LIBRARY_PATH"

## JVM memory management parameters:
# IMPORTANT: whenever you make adaptions here, please inform the HMI integration team before submitting!
# There are some automated processes recognizing the exact memory phrase.
VMOPTIONS="$VMOPTIONS -Xmca16k -Xmco16k -Xmoi0 -Xmn10m -Xmo50m -Xmx60m -Xmso1m"


# removed becauso of micro-jit -Xmjit:code=512 -Xmjit:codeTotal=2048"

##
## set some env variables as system properties
##

VMOPTIONS="$VMOPTIONS -DOEM=$OEM"
VMOPTIONS="$VMOPTIONS -DREGION=$REGION"
VMOPTIONS="$VMOPTIONS -DRUN_MODE=$RUN_MODE"

##
## set up GUI resource paths
##

case $RUN_MODE in
"swdl")
        echo "Start run mode swdl, copy fonts to RAMDISK"
		cp -R $BASE_DIR/fonts /ramdisk
		VMOPTIONS="$VMOPTIONS -Dhwg.font.path=/ramdisk/fonts"

        echo "copy images to RAMDISK"
        mkdir /ramdisk/images
        cp $BASE_DIR/lsd/images/default.png /ramdisk/images
		if [ -d $BASE_DIR/lsd/images/HMISystemEvoHigh ]; then
            echo "copy EvoHigh images to RAMDISK..."
            cp -R $BASE_DIR/lsd/images/HMISystemEvoHigh /ramdisk/images
		fi
        if [ -d $BASE_DIR/lsd/images/HMISystemEvoHighMMIKombi ]; then
            echo "copy EvoHighMMIKombi images to RAMDISK..."
            cp -R $BASE_DIR/lsd/images/HMISystemEvoHighMMIKombi /ramdisk/images
        fi
        if [ -d $BASE_DIR/lsd/images/HMISystemEvoHighScale ]; then
            echo "copy EvoHighScale images to RAMDISK..."
            cp -R $BASE_DIR/lsd/images/HMISystemEvoHighScale /ramdisk/images
        fi
		if [ -d $BASE_DIR/lsd/images/HMISystemPGen2High ]; then
            echo "copy PGen2 images to RAMDISK..."
            cp -R $BASE_DIR/lsd/images/HMISystemPGen2High /ramdisk/images
		fi
        if [ -d $BASE_DIR/lsd/images/0 ]; then
            echo "copy PorscheSystem images to RAMDISK..."
            cp -R $BASE_DIR/lsd/images/0 /ramdisk/images
        fi
        if [ -d $BASE_DIR/lsd/images/17 ]; then
            echo "copy PorscheSWDL images to RAMDISK..."
            cp -R $BASE_DIR/lsd/images/17 /ramdisk/images
        fi

        echo "copy kzbs to RAMDISK"
        mkdir /ramdisk/kzbs
        if [ -d $BASE_DIR/lsd/kzbs/HMISystemEvoHigh ]; then
            echo "copy EvoHigh kzbs to RAMDISK..."
            cp -R $BASE_DIR/lsd/kzbs/HMISystemEvoHigh /ramdisk/kzbs
        fi
        if [ -d $BASE_DIR/lsd/kzbs/HMISystemEvoHighMMIKombi ]; then
            echo "copy EvoHighMMIKombi kzbs to RAMDISK..."
            cp -R $BASE_DIR/lsd/kzbs/HMISystemEvoHighMMIKombi /ramdisk/kzbs
        fi
        if [ -d $BASE_DIR/lsd/kzbs/HMISystemEvoHighScale ]; then
            echo "copy EvoHighScale kzbs to RAMDISK..."
            cp -R $BASE_DIR/lsd/kzbs/HMISystemEvoHighScale /ramdisk/kzbs
        fi
		if [ -d $BASE_DIR/lsd/kzbs/HMISystemPGen2High ]; then
            echo "copy PGen2 kzbs to RAMDISK..."
            cp -R $BASE_DIR/lsd/kzbs/HMISystemPGen2High /ramdisk/kzbs
        fi

		VMOPTIONS="$VMOPTIONS -DImageRoot=/ramdisk/images"
		VMOPTIONS="$VMOPTIONS -DKzbRoot=/ramdisk/kzbs"
        ;;
*)
		VMOPTIONS="$VMOPTIONS -Dhwg.font.path=$BASE_DIR/fonts"
		VMOPTIONS="$VMOPTIONS -DImageRoot=$BASE_DIR/lsd/images"
		VMOPTIONS="$VMOPTIONS -DKzbRoot=$BASE_DIR/lsd/kzbs"
        ;;
esac

# IMPORTANT: whenever you make adaptions here, please inform the HMI integration team before submitting!
# There are some automated processes recognizing the exact memory phrase.
VMOPTIONS="$VMOPTIONS -DealMemorySize=80"


VMOPTIONS="$VMOPTIONS -DinitialKZBs=6"
VMOPTIONS="$VMOPTIONS -DmergeSelectionDrawerOnDemand=true"

VMOPTIONS="$VMOPTIONS -DErrorDumpDir=$LOGFILES_DIR/"

VMOPTIONS="$VMOPTIONS -Dexternalized.logs.path=$BASE_DIR/lsd/ext_logs/"

# Set fallback of 'fwservices.json' from within JXE/ZIP if the \MMC3 partition is not valid
VMOPTIONS="$VMOPTIONS -Dipl.config.resource=/resources"

# paths for hmi_startup config
VMOPTIONS="$VMOPTIONS -Dipl.config.dir.hmi_startup=$BASE_DIR/lsd"

# Speller Charset Path (Pinyin conversion files can be found there in CN system)
VMOPTIONS="$VMOPTIONS -DSpellerCharacterSetPath=$BASE_DIR/lsd/SpellerCharacterSets"

## temporary settings for developement
#VMOPTIONS="$VMOPTIONS -DStorageProviderConfig=Sim"
#VMOPTIONS="$VMOPTIONS -DDefaultStorageProvider-PhysicalPath=$BASE_DIR/persistence"

## Enable Kanzi 3D support
#VMOPTIONS="$VMOPTIONS -Dshow3D=true"
#VMOPTIONS="$VMOPTIONS -Dplatform=QNX"
#VMOPTIONS="$VMOPTIONS -Ddisplayplugin"
#VMOPTIONS="$VMOPTIONS -DActivateAllCarMenus=true"
#VMOPTIONS="$VMOPTIONS -DSetCarMenusVisible=true"
#VMOPTIONS="$VMOPTIONS -DOfficial_Release=true"
#VMOPTIONS="$VMOPTIONS -DSetMenuCoding=ACC:5,INT_LIGHT:5,PARKING:1,AWV:5,LDW:5,SWA:5,EXT_LIGHT:5,WINDOW:0,AIRCONDITION:5,AUXHEATER:1,BC_CLUSTER:5,RDK:9,WIPER:5,SIA:5,SEAT:1,CENTRAL_LOCKING:5,COMPASS:0,CHARISMA:5,OILLEVEL:1,VIN:5,CLOCK:5,AIRSUSPENSION:0,HUD:0,UNITMASTER:5,HYBRID:5,UGDO:0,NIGHTVISION:0,SIDEVIEW:0,RGS:5,MFL_JOKER:5,TSD:5,ATTENTION_IDENT:0,APTIVE_KEY_CLAMP:5,MIRROR:0,DRV_SCHOOL:0,MKE:5,BCME:0"
#VMOPTIONS="$VMOPTIONS -DDebug3DToConsole=true"

VMOPTIONS="$VMOPTIONS -DSYNC_EARLY_RVC=true"
VMOPTIONS="$VMOPTIONS -DWAIT_FOR_MAP_AVAILABLE=20000"
VMOPTIONS="$VMOPTIONS -DWAIT_FOR_AUDIO_TIMEOUT=1"
VMOPTIONS="$VMOPTIONS -DWAIT_FOR_SDS_AVAILABLE=1"

#VMOPTIONS="$VMOPTIONS -Dmedia.config.usb=installed"
#VMOPTIONS="$VMOPTIONS -Dmedia.config.aux=installed"
#VMOPTIONS="$VMOPTIONS -Dmedia.config.tv=installed"

## unkomment following 2 lines for HighScale
#VMOPTIONS="$VMOPTIONS -Dmedia.config.cd=installed"
#VMOPTIONS="$VMOPTIONS -Dmedia.config.dvd=notinstalled"

## Always use StartUpConfig with all TV functions enabled.
VMOPTIONS="$VMOPTIONS -Dtv.startup.config.force.enable=true"

## Disable RRD calculation for POI name lists
#VMOPTIONS="$VMOPTIONS -DdisableRRDforPOI=true"

## Display error popup when navigation command queue was not completely executed
#VMOPTIONS="$VMOPTIONS -DActivateNaviDebugPopup=true"

## Enable NLU for SDS
VMOPTIONS="$VMOPTIONS -DenableNLU=true"

## disable SDS pause
#VMOPTIONS="$VMOPTIONS -DsdsPauseActive=false"

## enable logical popup for SDS
VMOPTIONS="$VMOPTIONS -DsdsLogicalPopup=true"

## enable external SDS (e.g. Siri)
VMOPTIONS="$VMOPTIONS -DexternalSDS=true"

## use DSITelephone/DSINAD instead of DSIMobileEquipment/DSIMobileEquipmentTopology
#VMOPTIONS="$VMOPTIONS -DuseLegacyDSITelephone=true"

#GEM Settings
VMOPTIONS="$VMOPTIONS -Dde.audi.gem.path.scriptfifo=/var"
VMOPTIONS="$VMOPTIONS -Dde.audi.gem.path.esdfiles=$BASE_DIR/engdefs"
VMOPTIONS="$VMOPTIONS -Dde.audi.gem.image.path=$BASE_DIR/lsd/images/GEM"
VMOPTIONS="$VMOPTIONS -Dde.audi.gem.font.path=$BASE_DIR/fonts/"

## Workaround to enable GEM
VMOPTIONS="$VMOPTIONS -DenableGEM=true"

## Mark as production version which disables some developer features
VMOPTIONS="$VMOPTIONS -DIS_PRODUCTION_MODE=true"

## enable import/ripping
# 1 - enabled
# 0 - disabled
#VMOPTIONS="$VMOPTIONS -DEOLFLAG_IMPORT_MEDIA_DATA=1"
#VMOPTIONS="$VMOPTIONS -DEOLFLAG_RIPPING_MEDIA_DATA=1"

#use new TTS client implementation
VMOPTIONS="$VMOPTIONS -DuseNewTtsClient=true"

## setup logging
#VMOPTIONS="$VMOPTIONS -DLOG=Fw.Startup=5,Fw.Domain=5"
VMOPTIONS="$VMOPTIONS -DLOG=all=0,Ext.Power=5"
VMOPTIONS="$VMOPTIONS -DSLOG=Ext.Startup=5,Fw.Error=2"

# to get HMI Event in a kernel trace uncomment the following line and adjust the log channel settings
#VMOPTIONS="$VMOPTIONS -DProf -DKLOG=Ext.Startup=5,Fw.Startup=5,Fw.Domain=5"

# uncomment to get the possibility to trigger an error dump by connecting to this port
VMOPTIONS="$VMOPTIONS -DErrorDumpTriggerPort=6767"

## This option is for remote debugging
#VMOPTIONS="-Xdebug -Xnoagent -Xrunjdwp:transport=dt_socket,server=y,suspend=n,address=12345 $VMOPTIONS"

## SWDL auto retries (retries without user interaction)
VMOPTIONS="$VMOPTIONS -DSWDLAutoRetries=0"

VMOPTIONS="$VMOPTIONS -Dde.audi.tghu.traceConfig=$BASE_DIR/lsd/traceConfig.properties"

#dsi tracer
DSITRACER=$BASE_DIR/lsd/DSITracer.jar

if [[ ${RUN_MODE} = "eso_screening" ]]; then
  VMOPTIONS="$VMOPTIONS -Dlsd.bundles=$BASE_DIR/lsd/bundles_headless.properties"
else
  DSITRACER_PROPFILE=$BASE_DIR/lsd/bundles_dsitracer_enabled.properties
  if [[ -f $BASE_DIR/lsd/dsitracer_activated && -f "$DSITRACER" && -f $DSITRACER_PROPFILE ]]; then
    VMOPTIONS="$VMOPTIONS -Dlsd.bundles=$DSITRACER_PROPFILE"
  else
    if [[ -f $DEV_ACTIVATED ]]; then
      VMOPTIONS="$VMOPTIONS -Dlsd.bundles=$BASE_DIR/lsd/bundles.properties"
    fi
  fi
fi

##
## Green Menu
##
VMOPTIONS="$VMOPTIONS -Dde.audi.tghu.engineering.base_dir=$BASE_DIR/engdefs"
VMOPTIONS="$VMOPTIONS -Dgreenmenu.jobs.searchLocation=sd*/home/jobs/job.mf@/fs"
VMOPTIONS="$VMOPTIONS -Dde.audi.gem.SlideShowSearchPath=sd*/slideshow/*.png@/fs"

## Path for screenshots
#VMOPTIONS="$VMOPTIONS -Dscreenshot.dirs=/fs/sda0;/fs/sdb0;/fs/usb0;/fs/usb1;/tmp"

##
## Java DSI adapter configuration
##
#VMOPTIONS="$VMOPTIONS -Dipl.config.dir=$BASE_DIR/../config/production"
#VMOPTIONS="$VMOPTIONS -Dipl.config.myProcName=hmi"


##
## Temporary: Activating all car menus
##
#VMOPTIONS="$VMOPTIONS -DActivateAllCarMenus=true"
##
## Temporary: Set coding: car menu operation flags via lsd.sh
##
#VMOPTIONS="$VMOPTIONS -DSetMenuCoding=ACC:5,INT_LIGHT:5,PARKING:1,AWV:5,LDW:5,SWA:5,EXT_LIGHT:5,WINDOW:0,AIRCONDITION:5,AUXHEATER:5,BC_CLUSTER:5,RDK:9,WIPER:5,SIA:5,SEAT:1,CENTRAL_LOCKING:5,COMPASS:0,CHARISMA:5,OILLEVEL:0,VIN:5,CLOCK:5,AIRSUSPENSION:0,HUD:0,UNITMASTER:5,HYBRID:0,UGDO:0,NIGHTVISION:0,SIDEVIEW:0,RGS:0,MFL_JOKER:5,TSD:5,ATTENTION_IDENT:0,APTIVE_KEY_CLAMP:5,MIRROR:0,DRV_SCHOOL:0,MKE:5,BCME:0"

##
## ruco2433 Hack for vehicle id
##
VMOPTIONS="$VMOPTIONS -DmyAudi.VIN=BAUIEE4HZ09012808"
VMOPTIONS="$VMOPTIONS -DmyAudi.IMSI=2620225510"

##
## Pretend BT audio is enabled via diagnosis coding option even if in fact it isn't.
##
#VMOPTIONS="$VMOPTIONS -DoverrideBtMediaDiagCode=true"

##
## Ignore speed threshold violations in Bluetooth.
##
#VMOPTIONS="$VMOPTIONS -DbtIgnoreSpeedThreshold=true"

##
## Enable the fast inquiry mode for Bluetooth device scans (inquire names only, not the services).
##
#VMOPTIONS="$VMOPTIONS -Dbluetooth.enableFastInquiry=true"

##
## Profiler remote connection
##
#VMOPTIONS="$VMOPTIONS -Xrunprof:listen=5115"

##
## Switch screen resolution
##
#VMOPTIONS="$VMOPTIONS -DScreenRes=1"
#VMOPTIONS="$VMOPTIONS -DScreenRes=4"

##
## activate combi sync protocol (DSIKombiSync) evaluation
##
#VMOPTIONS="$VMOPTIONS -DTestCombiSync=true"

##
## Disable rubberband crosshair
##
if [[ -f "$BASE_DIR/disableRubberbandCrosshair" ]]; then
	echo "######################################"
	echo "# DISABLING RUBBERBAND CROSSHAIR"
	echo "######################################"
	VMOPTIONS="$VMOPTIONS -DdisableScrollByCrosshairs=true"
fi

##
## Activate partial rendering mode.
VMOPTIONS="$VMOPTIONS -DpartialRenderingEnabled=false"
##

## Enable tryBestMatch instead of liTryMatchLocation for addresses in Navi IntelliDest
##
#VMOPTIONS="$VMOPTIONS -DuseTryBestMatch=true"

## skip all license check screens (e.g. useful to start Google Earth without valid license)
#VMOPTIONS="$VMOPTIONS -DSkipLicenseCheck=true"

##
## Setup boot class path / conditionally include DSITracer:
##
LSD_JXE=$LSD_DIR/lsd.jxe

#development mode
if [[ -f $DEV_ACTIVATED ]]; then
	echo "######################################"
	echo "#     DEVELOPER MODE ACTIVE          #"
	echo "######################################"
	echo "BASEDIR = $BASE_DIR"

    VMOPTIONS="$VMOPTIONS -Ddev_mode=true"

	##
	## hmi.zip classpath
	##
	HMI_ZIP=$BASE_DIR/lsd/hmi.zip
	if [ -f "$HMI_ZIP" ]; then
		BOOTCLASSPATH="$BOOTCLASSPATH:$HMI_ZIP"
	fi

	# use JXE from basedir (eso/hmi) if it exists
	if [[ -f $BASE_DIR/lsd/lsd.jxe ]]; then
		LSD_JXE=$BASE_DIR/lsd/lsd.jxe
	fi
fi

if [[ -f $BASE_DIR/lsd/dsitracer_activated && -f "$DSITRACER" ]]; then
        BOOTCLASSPATH="$BOOTCLASSPATH:$DSITRACER"
fi
##
## Find and append jar files
##
MIBSI_JAR_CLASSPATH=""
if [[ -d $BASE_DIR/lsd/jars ]]; then
	JARS=$(find $BASE_DIR/lsd/jars/ -name '*.zip' -or -name '*.jar')
	if [[ ! "x$JARS" == "x" ]]; then
		for jar in $JARS; do
			BOOTCLASSPATH="$BOOTCLASSPATH:$jar"
			MIBSI_JAR_CLASSPATH="${MIBSI_JAR_CLASSPATH:+$MIBSI_JAR_CLASSPATH:}$jar"
		done
	fi
fi


#HYBRID_JAR=$BASE_DIR/lsd/hybrid.jar
#if [ -f "$HYBRID_JAR" ]; then
#  BOOTCLASSPATH="$BOOTCLASSPATH:$HYBRID_JAR"
#fi

#Diagnosis output in development mode:
if [[ -f $DEV_ACTIVATED ]]; then
	echo "JAVA_HOME=$JAVA_HOME"
	echo "VMOPTIONS=$VMOPTIONS"
	echo "BOOTCLASSPATH=$BOOTCLASSPATH (plus lsd.jxe)"
	echo "LD_LIBRARY_PATH=$LD_LIBRARY_PATH"
fi
##
## Launch J9
##

# ldd $MOUNT_DIR/j9/bin/j9
# ldd ../hybrid/libhybrid.so
# j9 -help

## start j9 in background to finish ksh process.
## if the ksh is left running, this seems to cause some memory management trouble in QNX

if [[ -f $DEV_ACTIVATED && -f "$HMI_ZIP" ]]; then
	# start hmi.zip
	info "starting j9 with $HMI_ZIP"
	$J9 $VMOPTIONS -Xbootclasspath:$BOOTCLASSPATH ${MIBSI_JAR_CLASSPATH:+-Xbootclasspath/p:$MIBSI_JAR_CLASSPATH} de.dreisoft.lsd.LSD &
else
	if [[ -f "$LSD_JXE" ]]; then
		# start lsd.jxe
		BOOTCLASSPATH="$BOOTCLASSPATH:$LSD_JXE"
		info "starting j9 ...."
		$J9 $VMOPTIONS -Xbootclasspath:$BOOTCLASSPATH ${MIBSI_JAR_CLASSPATH:+-Xbootclasspath/p:$MIBSI_JAR_CLASSPATH} -jxe:$LSD_JXE &
	else
		echo !!!!!  lsd.jxe not found !!!!!
	fi
fi
```

</details>

### Source 03: projection lifecycle integration

Original path: `reverse-engineered/java-vineflower/de/audi/app/terminalmode/combi/TerminalModeBapCombi.java`

<details id="source-03">
<summary>Read complete source</summary>

<!-- source-file: reverse-engineered/java-vineflower/de/audi/app/terminalmode/combi/TerminalModeBapCombi.java; terminal-newline: yes -->

```java
/* Reconstructed by Vineflower 1.12.0; not original source. */package de.audi.app.terminalmode.combi;

import com.nicolas.carplay.core.CarPlayApp;
import de.audi.app.terminalmode.IContext;
import de.audi.app.terminalmode.ITerminalModeComponent;
import de.audi.app.terminalmode.audio.AudioConnectionState;
import de.audi.app.terminalmode.audio.IAudioStateListener;
import de.audi.app.terminalmode.device.IActiveDeviceStateListener;
import de.audi.app.terminalmode.device.TMDevice;
import de.audi.app.terminalmode.device.TMDevice.ConnectionState;
import de.audi.app.terminalmode.events.DefaultEventListener;
import de.audi.app.terminalmode.events.TrackDataChangedEvent;
import de.audi.app.terminalmode.events.TrackPlayPositionEvent;
import de.audi.app.terminalmode.events.TrackDataChangedEvent.Builder;
import de.audi.app.terminalmode.osgi.IServiceManager;
import de.audi.app.terminalmode.osgi.IServiceTracker;
import de.audi.atip.interapp.bap.data.TimeStamp;
import de.audi.atip.interapp.combi.bap.audio.CombiBAPServiceTerminalMode;
import de.audi.atip.interapp.combi.bap.audio.data.CombiBAPCurrentStationInfo;
import de.audi.atip.interapp.combi.bap.audio.data.PlayPosition;
import de.audi.atip.interapp.def.DefaultServiceTrackerCustomizer;
import de.audi.atip.log.LogChannel;
import org.osgi.framework.BundleContext;
import org.osgi.framework.ServiceReference;

public class TerminalModeBapCombi implements ITerminalModeComponent {
   private static final String LOGCLASS = "TerminalModeBapCombi";
   private final IContext context;
   private final BundleContext bundleContext;
   private final LogChannel lc;
   private final IServiceTracker serviceTracker;
   private final IServiceManager serviceManager;
   private final TerminalModeBapCombi.EventListener eventListener;
   private final TerminalModeBapCombi.CachingEventListener cachingEventListener;
   private volatile CombiBAPServiceTerminalMode bapService;
   private TerminalModeBapCombi.ActiveDeviceStateListener activeDeviceListener;
   private final IAudioStateListener audioStateListener;

   public TerminalModeBapCombi(IContext var1) {
      this.context = var1;
      this.bundleContext = this.context.getFramework().getBundleCxt();
      this.lc = this.context.getLogger().main();
      this.bapService = new NullCombiBAPService(this.lc);
      this.serviceManager = this.context.getServiceManager();
      this.serviceTracker = this.serviceManager
         .createServiceTracker(CombiBAPServiceTerminalMode.class, new TerminalModeBapCombi.CombiBapServiceTrackerCustomizer(this, null));
      this.eventListener = new TerminalModeBapCombi.EventListener(this, null);
      this.cachingEventListener = new TerminalModeBapCombi.CachingEventListener(this, null);
      this.activeDeviceListener = new TerminalModeBapCombi.ActiveDeviceStateListener(this, null);
      this.audioStateListener = new TerminalModeBapCombi.AudioStateListener(this, null);
   }

   public void init() {
      this.serviceTracker.open();
      this.context.getEventBus().registerListener(this.cachingEventListener);
      this.context.getDeviceManager().addActiveDeviceListener(this.activeDeviceListener);
      this.context.getAudioManager().addAudioContextListener(this.audioStateListener);

      try {
         CarPlayApp.startTransport(this.context);
      } catch (Throwable var2) {
      }
   }

   public void deinit() {
      try {
         CarPlayApp.onDeactivateAndWait();
      } catch (Throwable var2) {
      }

      this.serviceTracker.close();
      this.context.getEventBus().unregisterListener(this.eventListener);
      this.context.getEventBus().unregisterListener(this.cachingEventListener);
      this.context.getDeviceManager().removeActiveDeviceListener(this.activeDeviceListener);
      this.context.getAudioManager().removeAudioContextListener(this.audioStateListener);
   }

   private final class ActiveDeviceStateListener implements IActiveDeviceStateListener {
      private final TerminalModeBapCombi this$0;

      private ActiveDeviceStateListener(TerminalModeBapCombi var2) {
         this.this$0 = var2;
      }

      public void updateActiveDeviceState(TMDevice var1) {
         if (var1.connectionState().is(ConnectionState.ACTIVATING)) {
            this.this$0.bapService.updateActiveInfoState(9);
            int var2 = this.getBapSourceType(var1);
            this.this$0.bapService.updateActiveSource(var2, 0, 0, false, false, 0);
            this.this$0.bapService.updateCurrentStation(new CombiBAPCurrentStationInfo());
            this.this$0
               .bapService
               .updatePlayPosition(
                  PlayPosition.builder()
                     .setTimePosition(TimeStamp.getInstanceFromSeconds(65535))
                     .setTotalPlayTime(TimeStamp.getInstanceFromSeconds(65535))
                     .build()
               );
            this.this$0.bapService.updateActiveInfoState(9);
            if (var1.isAndroidAutoDevice() || var1.isCarplayDevice()) {
               try {
                  CarPlayApp.onActivate(this.this$0.context, var1.isCarplayDevice() ? "carplay" : "aa");
               } catch (Throwable var6) {
               }
            }
         }

         if (var1.connectionState().is(ConnectionState.ACTIVE) && (var1.isAndroidAutoDevice() || var1.isCarplayDevice()) && !CarPlayApp.isActive()) {
            try {
               CarPlayApp.onActivate(this.this$0.context, var1.isCarplayDevice() ? "carplay" : "aa");
            } catch (Throwable var5) {
            }
         }

         if (!var1.isAndroidAutoDevice() && !var1.isCarplayDevice() && CarPlayApp.isActive()) {
            try {
               CarPlayApp.onDeactivate();
            } catch (Throwable var4) {
            }
         }
      }

      private int getBapSourceType(TMDevice var1) {
         if (var1.isCarplayDevice()) {
            return 37;
         } else {
            return var1.isAndroidAutoDevice() ? 39 : 40;
         }
      }
   }

   private final class AudioStateListener implements IAudioStateListener {
      private final TerminalModeBapCombi this$0;

      private AudioStateListener(TerminalModeBapCombi var2) {
         this.this$0 = var2;
      }

      public void audioStateChanged(AudioConnectionState var1) {
      }

      public void audioFocusChanged(boolean var1) {
         if (var1) {
            this.this$0.context.getEventBus().registerListener(this.this$0.eventListener);
            this.this$0.cachingEventListener.sendCachedEvents();
         } else {
            this.this$0.context.getEventBus().unregisterListener(this.this$0.eventListener);
         }
      }
   }

   private class CachingEventListener extends DefaultEventListener {
      private final TrackPlayPositionEvent INVALID_TIME;
      private final TrackDataChangedEvent INVALID_TRACK;
      private TrackPlayPositionEvent lastPlayPositionEvent;
      private TrackDataChangedEvent lastTrackData;
      private final TerminalModeBapCombi this$0;

      private CachingEventListener(TerminalModeBapCombi var2) {
         this.this$0 = var2;
         this.INVALID_TIME = new TrackPlayPositionEvent(-1, 0);
         this.INVALID_TRACK = new Builder().build();
         this.lastPlayPositionEvent = this.INVALID_TIME;
         this.lastTrackData = this.INVALID_TRACK;
      }

      public void updateNowPlayingData(TrackDataChangedEvent var1) {
         this.lastTrackData = var1;
      }

      public void updatePlayPosition(TrackPlayPositionEvent var1) {
         this.lastPlayPositionEvent = var1;
      }

      public void sendCachedEvents() {
         if (!this.INVALID_TIME.equals(this.lastPlayPositionEvent)) {
            this.this$0.eventListener.updatePlayPosition(this.lastPlayPositionEvent);
         }

         if (!this.INVALID_TRACK.equals(this.lastTrackData)) {
            this.this$0.eventListener.updateNowPlayingData(this.lastTrackData);
         }
      }

      public void clearCachedEvents() {
         this.lastPlayPositionEvent = this.INVALID_TIME;
         this.lastTrackData = this.INVALID_TRACK;
      }
   }

   private final class CombiBapServiceTrackerCustomizer extends DefaultServiceTrackerCustomizer {
      private final TerminalModeBapCombi this$0;

      private CombiBapServiceTrackerCustomizer(TerminalModeBapCombi var2) {
         this.this$0 = var2;
      }

      public Object addingService(ServiceReference var1) {
         CombiBAPServiceTerminalMode var2 = (CombiBAPServiceTerminalMode)this.this$0.context.getServiceManager().getService(var1);
         if (var2 != null) {
            this.this$0.bapService = var2;
         }

         return var2;
      }

      public void removedService(ServiceReference var1, Object var2) {
         this.this$0.bapService = new NullCombiBAPService(this.this$0.lc);
         this.this$0.bundleContext.ungetService(var1);
      }
   }

   private class EventListener extends DefaultEventListener {
      private final TerminalModeBapCombi this$0;

      private EventListener(TerminalModeBapCombi var2) {
         this.this$0 = var2;
      }

      public void updateNowPlayingData(TrackDataChangedEvent var1) {
         String var2 = var1.getTitle();
         String var3 = var1.getArtist();
         String var4 = var1.getAlbum();
         if (var2 == null) {
            var2 = "";
         }

         if (var3 == null) {
            var3 = "";
         }

         if (var4 == null) {
            var4 = "";
         }

         int var5 = var2.length() > 0 ? 6 : 0;
         int var6 = var3.length() > 0 ? 73 : 0;
         int var7 = var4.length() > 0 ? 74 : 0;
         CombiBAPCurrentStationInfo var8 = new CombiBAPCurrentStationInfo();
         var8.setPrimaryInformation(var2, var5, 0);
         var8.setSecondaryInformation(var3, var6);
         var8.setTertiaryInformation(var4, var7);
         this.this$0.bapService.updateCurrentStation(var8);
         this.this$0.bapService.updateActiveInfoState(0);
      }

      public void updatePlayPosition(TrackPlayPositionEvent var1) {
         if (var1.getTotalTimeOfTrack() == 0) {
            this.this$0
               .bapService
               .updatePlayPosition(
                  PlayPosition.builder()
                     .setTimePosition(TimeStamp.getInstanceFromSeconds(65535))
                     .setTotalPlayTime(TimeStamp.getInstanceFromSeconds(65535))
                     .build()
               );
         } else {
            this.this$0
               .bapService
               .updatePlayPosition(
                  PlayPosition.builder()
                     .setTimePosition(TimeStamp.getInstanceFromSeconds(var1.getPlayTime()))
                     .setTotalPlayTime(TimeStamp.getInstanceFromSeconds(var1.getTotalTimeOfTrack()))
                     .build()
               );
         }
      }
   }
}
```

</details>

### Source 04: Android Auto native evidence

Original path: `reverse-engineered/inventory/libmhi2qaacluster.so.strings.txt`

<details id="source-04">
<summary>Read complete source</summary>

<!-- source-file: reverse-engineered/inventory/libmhi2qaacluster.so.strings.txt; terminal-newline: yes -->

```text
000007b9	_init
000007bf	_fini
000007c5	_ITM_deregisterTMCloneTable
000007e1	_ITM_registerTMCloneTable
000007fb	__cxa_finalize
0000080a	__deregister_frame_info
00000822	__register_frame_info
00000838	_Jv_RegisterClasses
0000084c	memcpy
00000853	pthread_mutex_lock
00000866	pthread_mutex_unlock
0000087b	memcmp
00000882	malloc
0000088e	getenv
00000895	strtoul
0000089d	realloc
000008a5	usleep
000008ac	write
000008b2	close
000008b8	lseek
000008c3	strcmp
000008ca	memset
000008d1	pthread_create
000008e0	pthread_detach
000008ef	strncmp
000008f7	unlink
000008fe	dladdr
00000905	dlopen
0000090c	dlsym
00000912	sysconf
0000091a	mprotect
00000923	dlerror
0000092b	__get_errno_ptr
0000093b	strlen
00000942	rename
00000949	pthread_cond_wait
0000095b	pthread_cond_signal
0000096f	pthread_join
0000097c	clock_gettime
0000098a	vsnprintf
00000994	accept
0000099b	fcntl
000009a6	sigemptyset
000009b2	sigaddset
000009bc	pthread_sigmask
000009cc	pthread_cond_timedwait
000009e3	socket
000009ea	setsockopt
000009fa	listen
00000a01	shutdown
00000a0a	access
00000a11	spawnl
00000a1d	waitpid
00000a25	libsocket.so.3
00000a34	_btext
00000a3b	__exidx_start
00000a49	__exidx_end
00000a55	__data_start
00000a62	_edata
00000a69	__bss_start
00000a75	__bss_start__
00000a83	__bss_end__
00000a8f	__end__
00000a97	_stack
00000a9e	libmhi2qaacluster.so
00000ab3	libsocket.so.2
0000b6b8	_ZN24NavigationStatusEndpoint12routeMessageEhtRK10shared_ptrI8IoBufferE
0000b700	_ZN13MessageRouter15registerServiceEP20ProtocolEndpointBase
0000b73c	AA_CLUSTER_SERVICE_ID
0000b754	%02x%s
0000b760	libautoreceiver.so
0000b774	/eso/lib/libautoreceiver.so
0000b798	/tmp/mhi2q_aa_sdr_stock.pb
0000b7b4	/tmp/mhi2q_aa_sdr_cluster.pb
0000b7d4	/tmp/mhi2q_aa_ui_view.state
0000b7f0	/mnt/app/root/mhi2q_aa_vc_backup/mode
0000b81c	register
0000b828	announce
0000b834	vc-full-input
0000b844	AA_CLUSTER_OUTPUT
0000b860	native
0000b868	stream
0000b874	AA_CLUSTER_EXTERNAL_DISPLAY
0000b894	AA_CLUSTER_ENDPOINT
0000b8a8	legacy
0000b8b0	_ZN13MessageRouter13queueOutgoingEhPvj
0000b8ec	_ZN13MessageRouter13marshallProtoEtRKN6google8protobuf11MessageLiteEP8IoBuffer
0000b93c	_ZN13MediaSinkBase10sendConfigEi
0000b960	_ZN10Controller21handleVersionResponseEPvj
0000b99c	_ZN13MediaSinkBase9ackFramesEij
0000b9bc	_ZN13MessageRouter24queueOutgoingUnencryptedEhPvj
0000b9f0	_ZN9VideoSink13setVideoFocusEib
0000ba10	_ZN13MediaSinkBase12routeMessageEhtRK10shared_ptrI8IoBufferE
0000ba50	0123456789abcdef
0000ba64	MHI2Q_AA_NAV_V3
0000ba9c	%s.new
0000baa4	0123456789abcdef
0000bab8	/tmp/mhi2q_aa_nav_proxy.state
0000bad8	/tmp/mhi2q_aa_nav_proxy.state.new
0000bb2c	stream: viewer connected, waiting for complete IDR access unit
0000bb6c	stream: non-IDR received while unsynchronized; requesting focus bounce
0000bbb4	stream: cannot prime viewer without codec configuration
0000bbec	stream: viewer synchronized at complete IDR access unit
0000bc24	stream: viewer disconnected after %llu bytes
0000bc54	annex-b
0000bc5c	timed-access-units
0000bc70	framed-access-units
0000bc84	stream: socket creation failed errno=%d
0000bcac	stream: cannot listen on TCP port %u errno=%d
0000bcdc	stream: writer thread creation failed (%d)
0000bd08	stream: loopback ready port=%u mode=%s queue=%u bytes packets=%u max=%u
0000bd50	stream: oversized access unit length=%u max=%u
0000bd80	stream: queue saturated after %u ms; marking discontinuity packets=%u bytes=%u length=%u
0000bddc	display: external decoder disabled
0000be00	/eso/bin/apps/mhi2q-aa-cluster-display
0000be28	display: executable unavailable at %s errno=%d
0000be58	--live
0000be60	display: cannot spawn external decoder errno=%d
0000be90	display: external hardware decoder started pid=%d
0000bec4	display: cannot request UI-refresh hold pid=%d errno=%d
0000befc	display: UI-refresh hold requested pid=%d
0000bf28	display: external decoder exited status=0x%x
0000bf58	display: waitpid failed errno=%d
0000bf7c	display: external decoder did not exit after socket close; terminating
0000bfc4	/eso/bin/apps/mhi2q-aa-turn-card-renderer
0000bff0	turn-card: cannot spawn renderer errno=%d
0000c01c	turn-card: renderer started pid=%d
0000c040	turn-card: singleton owned by an earlier GAL renderer; retrying in 10s
0000c088	turn-card: renderer exited result=%d status=0x%x stop=%d
0000c0c4	turn-card: executable unavailable at %s errno=%d
0000c0f8	turn-card: cannot start supervisor rc=%d
0000e821	GCC: (GNU) 4.9.4
0000e833	GCC: (GNU) 4.9.4
0000e845	GCC: (GNU) 4.9.4
0000e857	GCC: (GNU) 4.9.4
0000e869	GCC: (GNU) 4.9.4
0000e87b	GCC: (GNU) 4.9.4
0000e88d	GCC: (GNU) 4.9.4
0000e89f	GCC: (GNU) 4.9.4
0000e8b1	GCC: (GNU) 4.9.4
0000e8c3	GCC: (GNU) 4.9.4
0000e8d5	GCC: (GNU) 4.9.4
0000e8e7	GCC: (GNU) 4.9.4
0000e8f9	GCC: (GNU) 4.9.4
0000e90b	GCC: (GNU) 4.9.4
0000e91d	GCC: (GNU) 4.9.4
0000e92f	GCC: (GNU) 4.9.4
0000e941	GCC: (GNU) 4.9.4
0000e953	GCC: (GNU) 4.9.4
0000e969	aeabi
0000e992	.shstrtab
0000e99c	.hash
0000e9a2	.dynsym
0000e9aa	.dynstr
0000e9b2	.gnu.version
0000e9bf	.gnu.version_r
0000e9ce	.rel.dyn
0000e9d7	.rel.plt
0000e9e0	.init
0000e9e6	.text
0000e9ec	.fini
0000e9f2	.rodata
0000e9fa	.ARM.exidx
0000ea05	.eh_frame
0000ea0f	.init_array
0000ea1b	.fini_array
0000ea2c	.dynamic
0000ea3a	.data
0000ea45	.comment
0000ea4e	.ARM.attributes
```

</details>

### Source 05: CarPlay native evidence

Original path: `reverse-engineered/inventory/libmhi2qcarplaycluster.so.strings.txt`

<details id="source-05">
<summary>Read complete source</summary>

<!-- source-file: reverse-engineered/inventory/libmhi2qcarplaycluster.so.strings.txt; terminal-newline: yes -->

```text
000007cd	_init
000007d3	_fini
000007d9	_ITM_deregisterTMCloneTable
000007f5	_ITM_registerTMCloneTable
0000080f	__cxa_finalize
0000081e	__deregister_frame_info
00000836	__register_frame_info
0000084c	_Jv_RegisterClasses
00000860	pthread_mutex_lock
00000873	pthread_mutex_unlock
00000888	pthread_cond_broadcast
000008a4	close
000008aa	clock_gettime
000008b8	select
000008bf	__get_errno_ptr
000008cf	recvfrom
000008d8	pthread_mutex_trylock
000008ee	waitpid
000008f6	spawnl
000008fd	shutdown
00000906	pthread_self
00000913	pthread_equal
00000921	pthread_join
0000092e	usleep
0000093a	pthread_cond_timedwait
00000951	memcpy
00000958	pthread_create
00000967	access
0000096e	sysconf
00000976	mprotect
0000097f	socket
0000098b	getpid
00000992	dlopen
00000999	dlsym
0000099f	memset
000009a6	write
000009ac	strlen
000009b3	pthread_cond_signal
000009c7	memmove
000009cf	realloc
000009d7	rename
000009de	unlink
000009e5	pthread_cond_wait
000009f7	CinemoCreateIAP
00000a07	_ZN14NmeIAP2Message6DecodeEPKhi
00000a27	_ZNK14NmeIAP2Message6EncodeER8NmeArrayIhE
00000a51	_ZN12NmeTransport4SendEPKhjPj
00000a6f	vsnprintf
00000a79	accept
00000a80	fcntl
00000a8b	sigemptyset
00000a97	sigaddset
00000aa1	pthread_sigmask
00000ab1	setsockopt
00000abc	listen
00000ac3	libsocket.so.3
00000ad2	_btext
00000ad9	__exidx_start
00000ae7	__exidx_end
00000af3	__data_start
00000b00	_edata
00000b07	__bss_start
00000b13	__bss_start__
00000b21	__bss_end__
00000b2d	__end__
00000b35	_stack
00000b3c	libmhi2qcarplaycluster.so
00000b56	libsocket.so.2
0000bb80	widthPixels
0000bb8c	heightPixels
0000bb9c	originXPixels
0000bbac	originYPixels
0000bbbc	drawUIOutsideSafeArea
0000bbd4	viewAreaTransitionControl
0000bbf0	safeArea
0000bc0c	b7e6c5a0-2222-4000-8000-000000000002
0000bc38	maps:/car/instrumentcluster
0000bc54	params
0000bc5c	streams
0000bc64	/tmp/mhi2q_aa_ui_view.state
0000bc80	showUI
0000bc88	stopUI
0000bc90	/eso/bin/apps/mhi2q-aa-cluster-display
0000bcb8	--live-carplay
0000bcc8	forceKeyFrame
0000bcd8	updateViewArea
0000bce8	viewAreaIndex
0000bcf8	animationDurationMillis
0000bd10	adjacentViewAreas
0000bd24	changeMapZoomLevel
0000bd38	zoomDirection
0000bd48	enabledFeatures
0000bd58	viewAreas
0000bd64	altScreen
0000bd70	streamConnectionID
0000bd84	dataPort
0000bd90	features
0000bd9c	displays
0000bda8	maxFPS
0000bdb0	widthPhysical
0000bdc0	heightPhysical
0000bdd0	primaryInputDevice
0000bde4	initialURL
0000bdf0	initialViewArea
0000be00	hidDevices
0000be0c	displayUUID
0000be20	Eso_Knob
0000be2c	hidDescriptor
0000be3c	MHI2Q_ClusterKnob
0000be50	libairplay.so
0000be60	AirPlayReceiverSessionSetup
0000be7c	AirPlayReceiverSessionTearDown
0000be9c	AirPlayCopyServerInfo
0000beb4	AirPlayReceiverSessionSendCommand
0000bed8	AirPlayReceiverSessionForceKeyFrame
0000befc	ScreenStreamCreate
0000bf10	_ZN3dio12OmxVideoImpl10initializeERPFvvE
0000bf3c	_ZN3dio12OmxVideoImpl6decodeEPhjyb
0000bf60	_ZN3dio12OmxVideoImpl9configureEjjjjjjj
0000bf88	_ZN3dio12OmxVideoImpl5startEv
0000bfa8	_ZN3dio12OmxVideoImpl4stopEv
0000bfc8	_ZN3dio12OmxVideoImpl13setVisibilityEh
0000bff0	CFStringCreateWithCString
0000c00c	CFPropertyListCreateDeepCopy
0000c02c	CFRelease
0000c038	CFDictionaryGetValue
0000c050	CFDictionarySetValue
0000c068	CFDictionaryGetInt64
0000c080	CFDictionarySetInt64
0000c098	CFDictionarySetCString
0000c0b0	CFDictionaryCreateMutable
0000c0cc	CFArrayCreateMutable
0000c0e4	CFArrayCreateMutableCopy
0000c100	CFArrayGetCount
0000c110	CFArrayGetValueAtIndex
0000c128	CFArrayAppendValue
0000c13c	CFArrayAppendCString
0000c154	CFPropertyListCreateData
0000c170	CFDataGetLength
0000c180	CFDataGetBytePtr
0000c194	AirPlayReceiverSessionScreen_Create
0000c1b8	AirPlayReceiverSessionScreen_Delete
0000c1dc	AirPlayReceiverSessionScreen_Setup
0000c200	AirPlayReceiverSessionScreen_SetTimeSynchronizer
0000c234	AirPlayReceiverSessionScreen_SetSecurityInfo
0000c264	AirPlayReceiverSessionScreen_UpdateState
0000c290	AirPlayReceiverSessionScreen_StartSession
0000c2bc	AirPlayReceiverSessionScreen_ProcessFrames
0000c2e8	AirPlayReceiverSessionScreen_StopSession
0000c314	AirPlay_DeriveAESKeySHA512ForScreen
0000c338	ServerSocketOpen
0000c34c	SocketAccept
0000c35c	NetSocket_CreateWithNative
0000c378	NetSocket_Delete
0000c38c	HIDDeviceCreateVirtual
0000c3a4	HIDRegisterDevice
0000c3b8	HIDDeregisterDevice
0000c3cc	HIDKnobFillReport
0000c3e0	HIDDevicePostReport
0000c3f4	HIDDeviceCopyProperty
0000c40c	CFRetain
0000c418	CFEqual
0000c420	kCFLDictionaryKeyCallBacksCFLTypes
0000c444	kCFLDictionaryValueCallBacksCFLTypes
0000c46c	kCFLArrayCallBacksCFLTypes
0000c488	kCFLBooleanFalse
0000c49c	_ZN3dio11CDIOManager28s_serverCopyPropertyCallbackEP28AirPlayReceiverServerPrivateP9CFLStringPKvPiPv
0000c504	_ZN14NmeIAP2Message6DecodeEPKhi
0000c524	_ZNK14NmeIAP2Message6EncodeER8NmeArrayIhE
0000c550	_ZN12NmeTransport4SendEPKhjPj
0000c570	CinemoCreateIAP
0000c580	ICinemoIAP_AddRef
0000c594	ICinemoIAP_Release
0000c5a8	ICinemoIAP_SendIAP2
0000c5bc	/tmp/mhi2q_carplay_nav_proxy.state.new
0000c5e4	/tmp/mhi2q_carplay_nav_proxy.state
0000c608	MHI2Q_AA_NAV_V2
0000c63c	0123456789abcdef
0000c650	RouteGuidanceDisplayComponent
0000c670	/eso/bin/apps/mhi2q-aa-turn-card-renderer
0000c69c	turn-card: cannot spawn renderer errno=%d
0000c6c8	turn-card: renderer started pid=%d
0000c6ec	turn-card: singleton owned by an earlier GAL renderer; retrying in 10s
0000c734	turn-card: renderer exited result=%d status=0x%x stop=%d
0000c770	turn-card: executable unavailable at %s errno=%d
0000c7a4	turn-card: cannot start supervisor rc=%d
0000c7d4	stream: viewer connected, waiting for complete IDR access unit
0000c814	stream: non-IDR received while unsynchronized; requesting focus bounce
0000c85c	stream: cannot prime viewer without codec configuration
0000c894	stream: viewer synchronized at complete IDR access unit
0000c8cc	stream: viewer disconnected after %llu bytes
0000c8fc	annex-b
0000c904	timed-access-units
0000c918	framed-access-units
0000c92c	stream: socket creation failed errno=%d
0000c954	stream: cannot listen on TCP port %u errno=%d
0000c984	stream: writer thread creation failed (%d)
0000c9b0	stream: loopback ready port=%u mode=%s queue=%u bytes packets=%u max=%u
0000c9f8	stream: oversized access unit length=%u max=%u
0000ca28	stream: queue saturated after %u ms; marking discontinuity packets=%u bytes=%u length=%u
0000f1b1	GCC: (GNU) 4.9.4
0000f1c3	GCC: (GNU) 4.9.4
0000f1d5	GCC: (GNU) 4.9.4
0000f1e7	GCC: (GNU) 4.9.4
0000f1f9	GCC: (GNU) 4.9.4
0000f20b	GCC: (GNU) 4.9.4
0000f21d	GCC: (GNU) 4.9.4
0000f22f	GCC: (GNU) 4.9.4
0000f241	GCC: (GNU) 4.9.4
0000f253	GCC: (GNU) 4.9.4
0000f265	GCC: (GNU) 4.9.4
0000f27b	aeabi
0000f2a2	.shstrtab
0000f2ac	.hash
0000f2b2	.dynsym
0000f2ba	.dynstr
0000f2c2	.gnu.version
0000f2cf	.gnu.version_r
0000f2de	.rel.dyn
0000f2e7	.rel.plt
0000f2f0	.init
0000f2f6	.text
0000f2fc	.fini
0000f302	.rodata
0000f30a	.ARM.exidx
0000f315	.eh_frame
0000f31f	.init_array
0000f32b	.fini_array
0000f33c	.dynamic
0000f34a	.data
0000f355	.comment
0000f35e	.ARM.attributes
```

</details>

### Source 06: Decoder/display helper evidence

Original path: `reverse-engineered/inventory/mhi2q-aa-cluster-display.strings.txt`

<details id="source-06">
<summary>Read complete source</summary>

<!-- source-file: reverse-engineered/inventory/mhi2q-aa-cluster-display.strings.txt; terminal-newline: yes -->

```text
000000f4	/usr/lib/ldqnx.so.2
00000aa1	libsocket.so.3
00000ab0	clock_gettime
00000abe	waitpid
00000ac6	connect
00000ace	sigemptyset
00000ada	strerror
00000ae3	getenv
00000aea	_Stdout
00000af2	memcpy
00000afe	malloc
00000b05	socket
00000b0c	dlclose
00000b19	calloc
00000b20	write
00000b26	fprintf
00000b2e	__deregister_frame_info
00000b46	__get_errno_ptr
00000b56	dlopen
00000b5d	memcmp
00000b64	sscanf
00000b6b	fread
00000b71	dlsym
00000b77	fopen
00000b7d	memset
00000b84	fclose
00000b8b	strcmp
00000b92	pthread_mutex_unlock
00000ba7	_Stderr
00000baf	access
00000bb6	pthread_mutex_lock
00000bce	_Jv_RegisterClasses
00000be2	fcntl
00000be8	__register_frame_info
00000c03	libc.so.3
00000c0d	dlerror
00000c15	_init_array
00000c21	errno
00000c27	usleep
00000c2e	_preinit_array
00000c3d	execl
00000c48	spawnl
00000c4f	fflush
00000c56	nanosleep
00000c65	fseek
00000c6b	memchr
00000c72	strstr
00000c79	signal
00000c80	unlink
00000c87	setenv
00000c93	sigaction
00000c9d	_init_libc
00000ca8	ftell
00000cae	_fini_array
00000cba	atexit
00000cc1	freopen
00000cc9	_exit
00000ccf	_btext
00000cd6	__exidx_start
00000ce4	__exidx_end
00000cf0	__data_start
00000cfd	_edata
00000d04	__bss_start
00000d10	__bss_start__
00000d1e	__bss_end__
00000d2a	__end__
00000d32	_stack
00000d39	qcom_tiled_copy_nv12_crop
00000d53	mibsi_vin_wait_allowed
00000d6a	_init
00000d70	qcom_tiled_draw_luma_rect
00000d8a	p5092_vc_route_restore
00000da1	aa_refresh_transition_update
00000dbe	qcom_tiled_plane_size
00000dd4	qcom_tiled_fill_nv12
00000de9	p5092_vc_route_projection_requested
00000e0d	_ITM_registerTMCloneTable
00000e27	p5092_vc_route_rearm
00000e3c	mibsi_vin_check
00000e4c	p5092_vc_route_poll
00000e60	_ITM_deregisterTMCloneTable
00000e7c	qcom_tiled_rect_is_black
00000e95	aa_refresh_transition_begin
00000eb1	_fini
00000eb7	qcom_tiled_read_luma
00000ecc	_Znwj
00000ed2	standalone_decoder_main
00000eea	libsocket.so.2
000068a0	output frame=%u bytes=%u flags=0x%08x timestamp=%lld
000068d8	event type=%u data1=0x%08x data2=0x%08x
00006908	open %s failed: %s
0000691c	OMX.QCOM.index.param.video.SyntaxHdr
00006944	SyntaxHdr index result=0x%08x index=0x%08x
00006970	SyntaxHdr set length=%u result=0x%08x
00006998	state=%u reached after %u ms
000069b8	state timeout wanted=%u current=%u
000069dc	missing %s: %s
000069ec	EmptyThisBuffer nal=%u result=0x%08x
00006a14	input return timeout at NAL %u
00006a34	submitted NAL units=%u
00006a4c	/tmp/mhi2q_aa_ui_view.state
00006a68	usage: %s stream.h264
00006a80	loaded %s: %lu bytes
00006a98	libOmxCore.so
00006aa8	dlopen libOmxCore.so failed: %s
00006acc	OMX_Init
00006ad8	OMX_Deinit
00006ae4	OMX_GetHandle
00006af4	OMX_FreeHandle
00006b04	OMX_Init=0x%08x
00006b18	OMX.qcom.video.decoder.avc
00006b34	OMX_GetHandle=0x%08x component=%p
00006b58	output formats end index=%u result=0x%08x
00006b84	output format index=%u compression=0x%08x color=0x%08x fps=0x%08x
00006bc8	port=%u query=0x%08x buffers=%u size=%u dimensions=%ux%u stride=%u slice=%u format=0x%08x
00006c24	SendCommand Idle=0x%08x
00006c40	AllocateBuffer port=%u index=%u result=0x%08x
00006c70	allocated port=%u count=%u
00006c8c	SendCommand Executing=0x%08x
00006cac	FillThisBuffer index=%u result=0x%08x
00006cd4	decode summary callbacks=%u frames=%u bytes=%llu
00006d08	cleanup Idle=0x%08x
00006d20	cleanup Loaded=0x%08x
00006d38	OMX_FreeHandle=0x%08x
00006d50	OMX_Deinit=0x%08x
00006d64	external hardware decode success=%d
00006d8c	--check-vin
00006d98	--live-carplay
00006da8	/dev/null
00006db4	IVRDISPLAY
00006dc0	SCREEN
00006dc8	LD_LIBRARY_PATH
00006dd8	/proc/boot:/usr/lib:/armle/lib:/armle/lib/dll:/armle/graphics:/lib:/mnt/app/root/lib-target:/eso/lib:/mnt/app/usr/lib:/mnt/app/armle/lib:/mnt/app/armle/lib/dll:/mnt/app/armle/usr/lib:/lib/dll
00006e98	AA_CLUSTER_HOLD
00006ea8	AA_CLUSTER_IVP_CONFIG_ONLY
00006ec4	AA_CLUSTER_CROP
00006edc	viewport
00006ee8	/mnt/app/root/mhi2q_aa_vc_backup/mode
00006f10	AA_CLUSTER_CROP_RECT
00006f28	%d,%d,%d,%d
00006f34	--live
00006f3c	OMX_SetupTunnel
00006f4c	stable direct decoder-to-Screen recovery path selected
00006f84	IPL_CONFIG_DIR
00006f94	/etc/eso/production
00006fa8	GRAPHICS_ROOT
00006fb8	/proc/boot/
00006fc4	DISPLAY_CATALOG_PATH
00006fe4	QC_GFX_CONF_DIR
00006ff4	/mnt/app/navigation
00007008	ADRENO
00007010	OXILI
00007018	libdisplayinit.so
0000702c	libscreen.so.1
0000703c	libEGL.so.1
00007048	display_init
00007058	display_create_window
00007070	screen_set_window_property_iv
00007090	screen_get_window_property_iv
000070b0	screen_create_window_buffers
000070d0	screen_destroy_window_buffers
000070f0	screen_destroy_window
00007108	screen_get_window_property_pv
00007128	screen_get_buffer_property_pv
00007148	screen_post_window
0000715c	screen_create_window
00007174	screen_create_window_type
00007190	eglGetDisplay
000071a0	eglInitialize
000071b0	eglChooseConfig
000071c0	eglGetError
000071cc	eglTerminate
000071dc	/etc/eso/production/
000071f4	/eso/bin/apps/versedt
0000720c	versedt
0000721c	/tmp/mhi2q_aa_context70.request
00007240	/eso/bin/apps/dmdt
000073a3	[/bin/sh
000073b4	IPL_CONFIG_DIR=/etc/eso/production exec /eso/bin/apps/pc s:1501:30 2>/dev/null
0000764c	MIBSI_VIN_RUNTIME_V1
00007684	VIN_END
0000768d	GCC: (GNU) 4.9.4
0000769f	GCC: (GNU) 4.9.4
000076b1	GCC: (GNU) 4.9.4
000076c3	GCC: (GNU) 4.9.4
000076d5	GCC: (GNU) 4.9.4
000076e7	GCC: (GNU) 4.9.4
000076f9	GCC: (GNU) 4.9.4
0000770b	GCC: (GNU) 4.9.4
0000771d	GCC: (GNU) 4.9.4
0000772f	GCC: (GNU) 4.9.4
00007741	GCC: (GNU) 4.9.4
00007757	aeabi
0000777e	.shstrtab
00007788	.interp
00007790	.hash
00007796	.dynsym
0000779e	.dynstr
000077a6	.gnu.version
000077b3	.gnu.version_r
000077c2	.rel.dyn
000077cb	.rel.plt
000077d4	.init
000077da	.text
000077e0	.fini
000077e6	.rodata
000077ee	.ARM.exidx
000077f9	.eh_frame
00007803	.init_array
0000780f	.fini_array
00007820	.dynamic
0000782e	.data
00007839	.comment
00007842	.ARM.attributes
```

</details>

### Source 07: Navigation reader

Original path: `reverse-engineered/java-vineflower/com/nicolas/carplay/aa/NavigationStateReader.java`

<details id="source-07">
<summary>Read complete source</summary>

<!-- source-file: reverse-engineered/java-vineflower/com/nicolas/carplay/aa/NavigationStateReader.java; terminal-newline: yes -->

```java
/* Reconstructed by Vineflower 1.12.0; not original source. */package com.nicolas.carplay.aa;

import java.io.BufferedReader;
import java.io.FileReader;
import java.util.StringTokenizer;

public final class NavigationStateReader {
   private static final String AA_STATE_FILE = "/tmp/mhi2q_aa_nav_proxy.state";
   private static final String CARPLAY_STATE_FILE = "/tmp/mhi2q_carplay_nav_proxy.state";
   private static final String MODE_FILE = "/tmp/mhi2q_aa_nav_proxy.mode";
   private static final String TEST_STATE_FILE = "/tmp/mhi2q_aa_turn_card_test.state";
   private static final String TEST_STATE_VERSION_V1 = "MHI2Q_AA_TURN_TEST_V1";
   private static final String TEST_STATE_VERSION_V2 = "MHI2Q_AA_TURN_TEST_V2";
   private static final long POLL_MS = 250L;
   private static final long TTL_MS = 3000L;
   private static volatile String projection = "stock";
   private final NavigationSnapshot snapshot = new NavigationSnapshot();
   private long nextPoll;
   private boolean testOverrideActive;
   private String appliedProjection = "stock";

   public NavigationSnapshot refresh() {
      return this.refresh(false);
   }

   public NavigationSnapshot refresh(boolean var1) {
      long var2 = System.currentTimeMillis();
      if (var2 < this.nextPoll) {
         return this.snapshot;
      }

      this.nextPoll = var2 + 250L;
      if (var1 && this.readTestState(var2)) {
         this.testOverrideActive = true;
         return this.snapshot;
      }

      if (this.testOverrideActive) {
         this.snapshot.sequence = -1;
         this.snapshot.updated = 0L;
         this.snapshot.active = false;
         this.snapshot.maneuver = 0;
         this.snapshot.laneGuidance = new byte[0];
         this.testOverrideActive = false;
      }

      String var4 = projection;
      if (!var4.equals(this.appliedProjection)) {
         this.clearSnapshot(var4);
         this.appliedProjection = var4;
      }

      this.snapshot.mode = "carplay".equals(var4) ? "carplay" : this.readMode();
      this.readState("carplay".equals(var4) ? "/tmp/mhi2q_carplay_nav_proxy.state" : "/tmp/mhi2q_aa_nav_proxy.state");
      return this.snapshot;
   }

   public static void setProjection(String var0) {
      if ("carplay".equals(var0)) {
         projection = "carplay";
      } else if ("aa".equals(var0)) {
         projection = "aa";
      } else {
         projection = "stock";
      }
   }

   public static boolean isFresh(String var0, boolean var1, long var2, long var4) {
      long var6 = var4 - var2;
      return ("aa".equals(var0) || "carplay".equals(var0)) && var1 && var2 > 0L && var6 >= 0L && var6 <= 3000L;
   }

   public void resetForTest(String var1) {
      this.snapshot.mode = var1;
      this.snapshot.sequence = -1;
      this.snapshot.updated = 0L;
      this.snapshot.active = false;
      this.snapshot.destinationDistanceMeters = -1;
      this.snapshot.timeToDestinationSeconds = -1;
      this.nextPoll = 0L;
      this.testOverrideActive = false;
   }

   private void clearSnapshot(String var1) {
      this.snapshot.mode = var1;
      this.snapshot.sequence = -1;
      this.snapshot.updated = 0L;
      this.snapshot.active = false;
      this.snapshot.maneuver = 0;
      this.snapshot.roundaboutExit = -1;
      this.snapshot.roundaboutAngle = -1;
      this.snapshot.distanceMeters = -1;
      this.snapshot.timeToStepSeconds = -1;
      this.snapshot.destinationDistanceMeters = -1;
      this.snapshot.timeToDestinationSeconds = -1;
      this.snapshot.currentRoad = "";
      this.snapshot.nextRoad = "";
      this.snapshot.instruction = "";
      this.snapshot.laneGuidance = new byte[0];
   }

   private boolean readTestState(long var1) {
      BufferedReader var3 = null;

      try {
         var3 = new BufferedReader(new FileReader("/tmp/mhi2q_aa_turn_card_test.state"));
         String var4 = var3.readLine();
         return parseTestState(var4, this.snapshot, var1);
      } catch (Throwable var15) {
         return false;
      } finally {
         if (var3 != null) {
            try {
               var3.close();
            } catch (Throwable var14) {
            }
         }
      }
   }

   private static boolean parseTestState(String var0, NavigationSnapshot var1, long var2) {
      if (var0 != null && var1 != null) {
         try {
            StringTokenizer var4 = new StringTokenizer(var0, "\t");
            int var5 = var4.countTokens();
            String var6 = var4.nextToken();
            boolean var7 = "MHI2Q_AA_TURN_TEST_V1".equals(var6);
            boolean var8 = "MHI2Q_AA_TURN_TEST_V2".equals(var6);
            if (var7 && var5 == 9 || var8 && var5 == 10) {
               int var9 = Integer.parseInt(var4.nextToken());
               int var10 = Integer.parseInt(var4.nextToken());
               int var11 = Integer.parseInt(var4.nextToken());
               int var12 = Integer.parseInt(var4.nextToken());
               int var13 = Integer.parseInt(var4.nextToken());
               int var14 = Integer.parseInt(var4.nextToken());
               int var15 = Integer.parseInt(var4.nextToken());
               int var16 = Integer.parseInt(var4.nextToken());
               byte[] var17 = var8 ? decodeLaneGuidance(var4.nextToken()) : new byte[0];
               if (var9 > 0 && var10 >= 0 && var10 <= 50) {
                  var1.mode = "aa";
                  var1.sequence = var9;
                  var1.updated = var2;
                  var1.active = true;
                  var1.maneuver = var10;
                  var1.roundaboutExit = var11;
                  var1.roundaboutAngle = var12;
                  var1.distanceMeters = var13;
                  var1.timeToStepSeconds = var14;
                  var1.destinationDistanceMeters = var15;
                  var1.timeToDestinationSeconds = var16;
                  var1.currentRoad = "TEST";
                  var1.nextRoad = "";
                  var1.instruction = "";
                  var1.laneGuidance = var17;
                  return true;
               } else {
                  return false;
               }
            } else {
               return false;
            }
         } catch (Throwable var18) {
            return false;
         }
      } else {
         return false;
      }
   }

   static NavigationSnapshot parseTestStateForTest(String var0, long var1) {
      NavigationSnapshot var3 = new NavigationSnapshot();
      return parseTestState(var0, var3, var1) ? var3 : null;
   }

   private String readMode() {
      BufferedReader var1 = null;

      try {
         var1 = new BufferedReader(new FileReader("/tmp/mhi2q_aa_nav_proxy.mode"));
         String var2 = var1.readLine();
         if (var2 == null) {
            return "aa";
         }

         var2 = var2.trim();
         if ("aa".equals(var2) || "stock".equals(var2) || "shadow".equals(var2)) {
            return var2;
         }
      } catch (Throwable var15) {
      } finally {
         if (var1 != null) {
            try {
               var1.close();
            } catch (Throwable var14) {
            }
         }
      }

      return "aa";
   }

   private void readState(String var1) {
      BufferedReader var2 = null;

      try {
         var2 = new BufferedReader(new FileReader(var1));
         String var3 = var2.readLine();
         if (var3 != null) {
            parseStateLine(var3, this.snapshot);
         }
      } catch (Throwable var12) {
      } finally {
         if (var2 != null) {
            try {
               var2.close();
            } catch (Throwable var11) {
            }
         }
      }
   }

   private static boolean parseStateLine(String var0, NavigationSnapshot var1) {
      if (var0 != null && var1 != null) {
         try {
            StringTokenizer var2 = new StringTokenizer(var0, "\t");
            int var3 = var2.countTokens();
            String var4 = var2.nextToken();
            boolean var5 = "MHI2Q_AA_NAV_V1".equals(var4);
            boolean var6 = "MHI2Q_AA_NAV_V2".equals(var4);
            boolean var7 = "MHI2Q_AA_NAV_V3".equals(var4);
            if (var5 && var3 == 13 || var6 && var3 == 15 || var7 && var3 == 16) {
               int var8 = Integer.parseInt(var2.nextToken());
               long var9 = Long.parseLong(var2.nextToken());
               boolean var11 = Integer.parseInt(var2.nextToken()) != 0;
               var2.nextToken();
               int var12 = Integer.parseInt(var2.nextToken());
               int var13 = Integer.parseInt(var2.nextToken());
               int var14 = Integer.parseInt(var2.nextToken());
               int var15 = Integer.parseInt(var2.nextToken());
               int var16 = Integer.parseInt(var2.nextToken());
               int var17 = !var6 && !var7 ? -1 : Integer.parseInt(var2.nextToken());
               int var18 = !var6 && !var7 ? -1 : Integer.parseInt(var2.nextToken());
               String var19 = decodeHex(var2.nextToken());
               String var20 = decodeHex(var2.nextToken());
               String var21 = decodeHex(var2.nextToken());
               byte[] var22 = var7 ? decodeLaneGuidance(var2.nextToken()) : new byte[0];
               var1.sequence = var8;
               var1.updated = var9;
               var1.active = var11;
               var1.maneuver = var12;
               var1.roundaboutExit = var13;
               var1.roundaboutAngle = var14;
               var1.distanceMeters = var15;
               var1.timeToStepSeconds = var16;
               var1.destinationDistanceMeters = var17;
               var1.timeToDestinationSeconds = var18;
               var1.currentRoad = var19;
               var1.nextRoad = var20;
               var1.instruction = var21;
               var1.laneGuidance = var22;
               return true;
            } else {
               return false;
            }
         } catch (Throwable var23) {
            return false;
         }
      } else {
         return false;
      }
   }

   static NavigationSnapshot parseStateForTest(String var0) {
      NavigationSnapshot var1 = new NavigationSnapshot();
      return parseStateLine(var0, var1) ? var1 : null;
   }

   private static byte[] decodeLaneGuidance(String var0) throws Exception {
      if ("-".equals(var0)) {
         return new byte[0];
      }

      if ((var0.length() & 1) == 0 && var0.length() <= 66) {
         byte[] var1 = decodeHexBytes(var0);
         if (var1.length == 0) {
            return var1;
         }

         int var2 = var1[0] & 255;
         if (var2 != 0 && var2 <= 8) {
            int var3 = 1;

            for (int var4 = 0; var4 < var2; var4++) {
               if (var3 >= var1.length) {
                  throw new IllegalArgumentException("missing lane");
               }

               int var5 = var1[var3++] & 255;
               if (var5 == 0 || var5 > 3 || var3 + var5 > var1.length) {
                  throw new IllegalArgumentException("invalid lane directions");
               }

               int var6 = 0;

               for (int var7 = 0; var7 < var5; var7++) {
                  int var8 = var1[var3++] & 255;
                  if ((var8 & 112) != 0 || (var8 & 15) > 9) {
                     throw new IllegalArgumentException("invalid lane shape");
                  }

                  if ((var8 & 128) != 0) {
                     if (++var6 > 1) {
                        throw new IllegalArgumentException("multiple selected directions");
                     }
                  }
               }
            }

            if (var3 != var1.length) {
               throw new IllegalArgumentException("trailing lane bytes");
            } else {
               return var1;
            }
         } else {
            throw new IllegalArgumentException("invalid lane count");
         }
      } else {
         throw new IllegalArgumentException("invalid lane hex");
      }
   }

   private static String decodeHex(String var0) throws Exception {
      if ("-".equals(var0)) {
         return "";
      } else if ((var0.length() & 1) == 0 && var0.length() <= 768) {
         return new String(decodeHexBytes(var0), "UTF-8");
      } else {
         throw new IllegalArgumentException("invalid hex text");
      }
   }

   private static byte[] decodeHexBytes(String var0) {
      byte[] var1 = new byte[var0.length() / 2];

      for (int var2 = 0; var2 < var1.length; var2++) {
         int var3 = Character.digit(var0.charAt(var2 * 2), 16);
         int var4 = Character.digit(var0.charAt(var2 * 2 + 1), 16);
         if (var3 < 0 || var4 < 0) {
            throw new IllegalArgumentException("invalid hex digit");
         }

         var1[var2] = (byte)(var3 << 4 | var4);
      }

      return var1;
   }
}
```

</details>

### Source 08: maneuver mapper

Original path: `reverse-engineered/java-vineflower/com/nicolas/carplay/aa/ManeuverMapper.java`

<details id="source-08">
<summary>Read complete source</summary>

<!-- source-file: reverse-engineered/java-vineflower/com/nicolas/carplay/aa/ManeuverMapper.java; terminal-newline: yes -->

```java
/* Reconstructed by Vineflower 1.12.0; not original source. */package com.nicolas.carplay.aa;

public final class ManeuverMapper {
   private static final int ICON_NONE = 0;
   private static final int ICON_APPROACH = 1;
   private static final int ICON_TURN = 2;
   private static final int ICON_UTURN = 3;
   private static final int ICON_MERGE = 4;
   private static final int ICON_EXIT = 5;
   private static final int ICON_ROUNDABOUT = 6;
   private static final int ICON_ARRIVED = 7;
   private static final int ICON_KEEP = 8;
   private static final int ICON_FORK = 9;

   private ManeuverMapper() {
   }

   public static boolean isHighway(int var0) {
      return var0 >= 13 && var0 <= 29;
   }

   public static int[] bapDescriptor(int var0, int var1) {
      byte var2 = 11;
      int var3 = direction(var0);
      if (var0 == 0) {
         var2 = 0;
      } else if (var0 == 1) {
         var2 = 11;
      } else if (var0 != 2 && var0 != 36) {
         if (var0 != 3 && var0 != 4 && (var0 < 27 || var0 > 29)) {
            if (var0 >= 5 && var0 <= 10) {
               var2 = 13;
            } else if (var0 == 11 || var0 == 12) {
               var2 = 25;
            } else if (var0 >= 13 && var0 <= 20) {
               var2 = (byte)(isLeft(var0) ? 18 : 17);
            } else if (var0 >= 21 && var0 <= 24) {
               var2 = (byte)(isLeft(var0) ? 16 : 15);
            } else if (var0 == 25 || var0 == 26) {
               var2 = 19;
            } else if (var0 >= 32 && var0 <= 35) {
               var2 = 21;
            } else if (var0 >= 39 && var0 <= 42) {
               var2 = 3;
            }
         } else {
            var2 = 12;
         }
      } else {
         var2 = 11;
      }

      if ((var0 == 33 || var0 == 35) && var1 >= 1 && var1 <= 360) {
         int var4 = var0 == 33 ? var1 - 180 : 180 - var1;
         var3 = -var4 * 256 / 360 & 0xFF;
      }

      return new int[]{var2, var3};
   }

   public static int[] rendererManeuver(int var0, int var1, int var2) {
      byte var3 = 1;
      int var4 = isLeft(var0) ? -1 : 1;
      int var5 = 0;
      byte var6 = 0;
      byte var7 = 0;
      if (var0 == 0) {
         var3 = 0;
         var4 = 0;
      } else if (var0 == 1
         || var0 == 2
         || var0 == 30
         || var0 == 31
         || var0 == 36
         || var0 == 37
         || var0 == 38
         || var0 == 43
         || var0 == 45
         || var0 == 47
         || var0 == 48
         || var0 == 49
         || var0 == 50) {
         var3 = 1;
         var4 = 0;
      } else if (var0 == 3 || var0 == 4) {
         var3 = 8;
      } else if (var0 >= 5 && var0 <= 10) {
         var3 = 2;
         if (var0 <= 6) {
            var5 = var4 * 45;
         } else if (var0 <= 8) {
            var5 = var4 * 90;
         } else {
            var5 = var4 * 135;
         }

         var4 = 0;
      } else if (var0 != 11 && var0 != 12) {
         if ((var0 < 13 || var0 > 18) && var0 != 27 && var0 != 28) {
            if (var0 == 19 || var0 == 20) {
               var3 = 3;
               var5 = var4 * 180;
               var6 = (byte)(var4 > 0 ? 1 : 0);
            } else if (var0 >= 21 && var0 <= 24) {
               var3 = 5;
            } else if (var0 == 25 || var0 == 26) {
               var3 = 9;
            } else if (var0 == 29) {
               var3 = 1;
               var4 = 0;
            } else if (var0 >= 32 && var0 <= 35) {
               var3 = 6;
               var4 = 0;
               boolean var8 = var0 == 32 || var0 == 33;
               var6 = (byte)(var8 ? 1 : 0);
               if ((var0 == 33 || var0 == 35) && var1 >= 1 && var1 <= 360) {
                  var5 = var8 ? var1 - 180 : 180 - var1;
                  var7 = 1;
               }
            } else if (var0 >= 39 && var0 <= 42) {
               var3 = 7;
               if (var0 == 39 || var0 == 40) {
                  var4 = 0;
               }
            } else if (var0 == 44) {
               var3 = 5;
               var4 = -1;
            } else if (var0 == 46) {
               var3 = 5;
               var4 = 1;
            }
         } else {
            var3 = 4;
         }
      } else {
         var3 = 3;
         var5 = var4 * 180;
         var6 = (byte)(var4 > 0 ? 1 : 0);
      }

      return new int[]{var3, var4, var5, var6, var7};
   }

   private static boolean isLeft(int var0) {
      return var0 == 3
         || var0 == 5
         || var0 == 7
         || var0 == 9
         || var0 == 11
         || var0 == 13
         || var0 == 15
         || var0 == 17
         || var0 == 19
         || var0 == 21
         || var0 == 23
         || var0 == 25
         || var0 == 27
         || var0 == 34
         || var0 == 41
         || var0 == 45
         || var0 == 47;
   }

   private static int direction(int var0) {
      switch (var0) {
         case 3:
         case 5:
            return 32;
         case 4:
         case 6:
            return 224;
         case 7:
         case 13:
         case 15:
         case 17:
         case 19:
         case 21:
         case 23:
         case 25:
         case 27:
         case 41:
         case 45:
         case 47:
            return 64;
         case 8:
         case 14:
         case 16:
         case 18:
         case 20:
         case 22:
         case 24:
         case 26:
         case 28:
         case 42:
         case 44:
         case 46:
         case 48:
         case 50:
            return 192;
         case 9:
            return 96;
         case 10:
            return 160;
         case 11:
         case 12:
            return 128;
         case 29:
         case 30:
         case 31:
         case 32:
         case 33:
         case 34:
         case 35:
         case 36:
         case 37:
         case 38:
         case 39:
         case 40:
         case 43:
         case 49:
         default:
            return 0;
      }
   }
}
```

</details>

### Source 09: turn-card policy

Original path: `reverse-engineered/java-vineflower/com/nicolas/carplay/rgd/TurnCardPolicy.java`

<details id="source-09">
<summary>Read complete source</summary>

<!-- source-file: reverse-engineered/java-vineflower/com/nicolas/carplay/rgd/TurnCardPolicy.java; terminal-newline: yes -->

```java
/* Reconstructed by Vineflower 1.12.0; not original source. */package com.nicolas.carplay.rgd;

import com.nicolas.carplay.aa.ManeuverMapper;

public final class TurnCardPolicy {
   private static final int PREPARE_CITY_M = 1500;
   private static final int PREPARE_HIGHWAY_M = 3000;
   private static final int ACTION_PERCENT = 15;
   private static final int OPEN_CITY_SECONDS = 35;
   private static final int CLOSE_CITY_SECONDS = 45;
   private static final int OPEN_HIGHWAY_SECONDS = 45;
   private static final int CLOSE_HIGHWAY_SECONDS = 55;
   private static final int OPEN_CITY_M = 450;
   private static final int CLOSE_CITY_M = 560;
   private static final int OPEN_HIGHWAY_M = 1200;
   private static final int CLOSE_HIGHWAY_M = 1500;

   private TurnCardPolicy() {
   }

   public static int actionThreshold(int var0) {
      int var1 = ManeuverMapper.isHighway(var0) ? 3000 : 1500;
      return var1 * 15 / 100;
   }

   public static boolean shouldOpen(int var0, int var1, int var2, boolean var3) {
      if (var2 == 0) {
         return false;
      }

      if (var2 >= 39 && var2 <= 42) {
         return true;
      }

      boolean var4 = ManeuverMapper.isHighway(var2);
      int var5 = var4 ? (var3 ? 55 : 45) : (var3 ? 45 : 35);
      int var6 = var4 ? (var3 ? 1500 : 1200) : (var3 ? 560 : 450);
      return var0 >= 0 && var0 <= var5 || var1 >= 0 && var1 <= var6;
   }

   public static int bapManeuverState(boolean var0, boolean var1) {
      if (!var0) {
         return 0;
      } else {
         return var1 ? 4 : 2;
      }
   }
}
```

</details>

### Source 10: Navigation coordinator

Original path: `reverse-engineered/java-vineflower/com/nicolas/carplay/rgd/Mhi2qAaNavProxy.java`

<details id="source-10">
<summary>Read complete source</summary>

<!-- source-file: reverse-engineered/java-vineflower/com/nicolas/carplay/rgd/Mhi2qAaNavProxy.java; terminal-newline: yes -->

```java
/* Reconstructed by Vineflower 1.12.0; not original source. */package com.nicolas.carplay.rgd;

import com.nicolas.carplay.aa.ManeuverMapper;
import com.nicolas.carplay.aa.NavigationSnapshot;
import com.nicolas.carplay.aa.NavigationStateReader;
import com.nicolas.carplay.core.Mhi2qAaClusterComposition;
import com.nicolas.carplay.framework.Log;
import de.audi.app.terminalmode.IContext;
import de.audi.app.terminalmode.osgi.IServiceManager;
import de.audi.atip.base.IFrameworkAccess;
import de.audi.atip.interapp.combi.bap.navi.CombiBAPServiceNavi;
import de.audi.atip.interapp.combi.bap.navi.data.CombiBAPNaviManeuverDescriptor;
import de.audi.atip.metrics.Distance;
import de.audi.atip.storage.IStorageAccess;
import de.audi.tghu.navi.app.Navigation;
import de.audi.tghu.navi.app.cluster.BAPDistanceFormatter;
import de.audi.tghu.navi.app.cluster.ClusterService;
import de.audi.tghu.navi.app.cluster.BAPDistanceFormatter.BAPDistance;
import de.esolutions.fw.util.commons.job.DispatcherBase;
import java.io.File;
import org.osgi.framework.ServiceReference;

public final class Mhi2qAaNavProxy implements Runnable {
   private static final long POLL_MS = 250L;
   public static final int VC_MODE_CLUSTER = 0;
   public static final int VC_MODE_OEM_MAP = 1;
   private static ClusterService cluster;
   private static IServiceManager serviceManager;
   private static ServiceReference serviceReference;
   private static CombiBAPServiceNavi rawService;
   private static Mhi2qAaGatedCombiService gate;
   private static BAPDistanceFormatter distanceFormatter;
   private static boolean workerStarted;
   private static Thread workerThread;
   private static boolean installScheduled;
   private static boolean sessionStarted;
   private static volatile boolean carPlayActive;
   private static volatile boolean deactivationRequested;
   private static int appliedMapScaleSuppression = -1;
   private static boolean previousRgActive;
   private static boolean oemResyncPending;
   private static int exitViewSendCount;
   private static int publishedRgStatus = -1;
   private static int publishedCardOpen = -1;
   private static int publishedRouteDataAvailable = -1;
   private static boolean navigationStateClaimed;
   private static int lastPublishedSequence = -1;
   private static int lastRenderedSequence = -1;
   private static boolean rendererHadFrame;
   private static volatile int rendererStateRevision;
   private static int lastRendererStateRevision;
   private static volatile int rendererConnectionRevision;
   private static int lastRendererConnectionRevision;
   private static boolean turnCardWindowOpen;
   private static boolean clusterCardAvailable;
   private static int presentationTokenCounter;
   private static int presentationToken;
   private static volatile boolean vcMenuRequested;
   private static volatile boolean vcMenuClosing;
   private static volatile int vcMenuSelection;
   private static volatile int vcActiveMode = 0;
   private static volatile int vcMenuToken;
   private static final int VC_STORAGE_SCOPE = 9000;
   private static final int VC_STORAGE_KEY = 1;
   private static final long VC_STORAGE_RETRY_MS = 5000L;
   private static volatile IFrameworkAccess vcStorageFramework;
   private static IStorageAccess vcStorageForTest;
   private static boolean vcPreferenceLoaded;
   private static int vcPreferenceRevision;
   private static int vcPersistedRevision;
   private static long vcStorageRetryAfter;
   private static final File VC_MENU_COMMAND = new File("/tmp/mhi2q_vc_menu_test.command");
   private static long vcMenuTestDeadline;
   private static final RendererServer renderer = new RendererServer();
   private static final NavigationStateReader stateReader = new NavigationStateReader();
   private static String mode = "aa";
   private static int sequence = -1;
   private static long updated;
   private static boolean active;
   private static int maneuver;
   private static int roundaboutExit;
   private static int roundaboutAngle;
   private static int distanceMeters;
   private static int timeToStepSeconds;
   private static int destinationDistanceMeters = -1;
   private static int timeToDestinationSeconds = -1;
   private static String currentRoad = "";
   private static String nextRoad = "";
   private static String instruction = "";
   private static byte[] laneGuidance = new byte[0];

   private Mhi2qAaNavProxy() {
   }

   public static synchronized boolean openVcSettingsMenu() {
      if (!carPlayActive || !Mhi2qAaClusterComposition.isLargeView()) {
         return false;
      }

      if (vcMenuRequested) {
         return true;
      }

      vcMenuRequested = true;
      vcMenuClosing = false;
      vcMenuSelection = vcActiveMode;
      presentationTokenCounter = nextPresentationTokenForTest(presentationTokenCounter);
      vcMenuToken = presentationTokenCounter;
      lastRenderedSequence = -1;
      return true;
   }

   public static synchronized void closeVcSettingsMenu() {
      if (vcMenuRequested) {
         vcMenuRequested = false;
         vcMenuClosing = true;
         vcMenuTestDeadline = 0L;
      }
   }

   public static synchronized void toggleVcSettingsMenu() {
      if (vcMenuRequested) {
         closeVcSettingsMenu();
      } else {
         openVcSettingsMenu();
      }
   }

   public static boolean isVcSettingsMenuRequested() {
      return vcMenuRequested;
   }

   public static synchronized boolean moveVcSettingsSelection(int var0) {
      enforceVcMenuView();
      if (vcMenuRequested && var0 != 0) {
         vcMenuSelection = wrapMenuSelectionForTest(vcMenuSelection, var0);
         return true;
      } else {
         return false;
      }
   }

   public static synchronized boolean selectVcSettingsItem() {
      enforceVcMenuView();
      if (!vcMenuRequested) {
         return false;
      }

      if (!vcPreferenceLoaded || vcActiveMode != vcMenuSelection) {
         vcPreferenceLoaded = true;
         vcPreferenceRevision++;
         vcStorageRetryAfter = 0L;
      }

      vcActiveMode = vcMenuSelection;
      Mhi2qAaClusterComposition.setClusterProjectionEnabled(vcActiveMode != 1);
      if (vcActiveMode == 1) {
         Mhi2qAaClusterComposition.setTurnCardVisible(false, 0);
      }

      closeVcSettingsMenu();
      appliedMapScaleSuppression = -1;
      wakeWorker();
      return true;
   }

   static synchronized void pollVcMenuTestCommand(long var0) {
   }

   static synchronized int[] vcMenuStateForTest() {
      return new int[]{vcMenuRequested ? 1 : 0, vcMenuClosing ? 1 : 0, vcMenuSelection, vcActiveMode};
   }

   public static synchronized void onCarPlayActivate() {
      carPlayActive = true;
      Mhi2qAaClusterComposition.setClusterProjectionEnabled(vcActiveMode != 1);
      deactivationRequested = false;
      navigationStateClaimed = false;
      appliedMapScaleSuppression = -1;
      wakeWorker();
   }

   public static synchronized void onCarPlayDeactivate() {
      carPlayActive = false;
      deactivationRequested = true;
      vcMenuTestDeadline = 0L;
      navigationStateClaimed = false;
      vcMenuRequested = false;
      vcMenuClosing = false;
      vcMenuToken = 0;
      appliedMapScaleSuppression = -1;
      Mhi2qAaClusterComposition.setVcMenuVisible(false, 0);
      wakeWorker();
   }

   public static void startTransport(Object var0) {
      try {
         if (!(var0 instanceof IContext)) {
            return;
         }

         synchronized (Mhi2qAaNavProxy.class) {
            serviceManager = ((IContext)var0).getServiceManager();

            try {
               vcStorageFramework = ((IContext)var0).getFramework();
            } catch (Throwable var4) {
            }

            startWorker();
         }
      } catch (Throwable var6) {
      }
   }

   public static synchronized CombiBAPServiceNavi prepareCombiBAPService(ClusterService var0, CombiBAPServiceNavi var1) {
      try {
         CombiBAPServiceNavi var2 = var1;
         if (var1 instanceof Mhi2qAaGatedCombiService) {
            var2 = ((Mhi2qAaGatedCombiService)var1).getRealService();
         }

         if (rawService != null && rawService != var2 && sessionStarted) {
            stopSession();
         }

         if (cluster != var0) {
            appliedMapScaleSuppression = -1;
         }

         cluster = var0;
         rawService = var2;
         distanceFormatter = var0 == null ? null : new BAPDistanceFormatter(var0.getMhi2qAaLogChannel());
         lastPublishedSequence = -1;
         if (var2 == null) {
            gate = null;
            log("MHI2Q AA BAP service detached");
            return null;
         } else {
            gate = new Mhi2qAaGatedCombiService(var2);
            appliedMapScaleSuppression = -1;
            gate.setBlocked(wantsProjectedBap() || sessionStarted);
            startWorker();
            log("MHI2Q AA BAP gate installed");
            return gate;
         }
      } catch (Throwable var3) {
         gate = null;
         rawService = var1;
         return var1;
      }
   }

   private static void startWorker() {
      if (!workerStarted) {
         Thread var0 = new Thread(new Mhi2qAaNavProxy(), "MHI2Q-AA-BAP");
         var0.setDaemon(true);

         try {
            workerThread = var0;
            var0.start();
            workerStarted = true;
         } catch (Throwable var2) {
            workerThread = null;
            workerStarted = false;
         }
      }
   }

   public void run() {
      while (true) {
         try {
            Thread.sleep(250L);
         } catch (InterruptedException var3) {
         }

         try {
            syncVcPreference();
            tick();
         } catch (Throwable var2) {
            failOpen();
         }
      }
   }

   private static void wakeWorker() {
      Thread var0 = workerThread;
      if (var0 != null) {
         var0.interrupt();
      }
   }

   private static void syncVcPreference() {
      long var5 = System.currentTimeMillis();
      IFrameworkAccess var0;
      IStorageAccess var1;
      boolean var2;
      int var3;
      int var4;
      synchronized (Mhi2qAaNavProxy.class) {
         if (var5 < vcStorageRetryAfter) {
            return;
         }

         var0 = vcStorageFramework;
         var1 = vcStorageForTest;
         var2 = vcPreferenceLoaded;
         var3 = vcPreferenceRevision;
         var4 = vcActiveMode;
         if (var2 && var3 == vcPersistedRevision) {
            return;
         }
      }

      try {
         IStorageAccess var7 = var1 != null ? var1 : (var0 == null ? null : var0.getStorageMgr());
         if (var7 == null) {
            return;
         }

         if (!var2) {
            int var8 = var7.getInt(9000, 1, 0);
            int var9 = var8 == 1 ? 1 : 0;
            boolean var10 = false;
            synchronized (Mhi2qAaNavProxy.class) {
               if (!vcPreferenceLoaded && vcPreferenceRevision == var3) {
                  vcPreferenceLoaded = true;
                  vcPersistedRevision = var3;
                  vcActiveMode = var9;
                  if (vcMenuRequested) {
                     vcMenuSelection = var9;
                  }

                  appliedMapScaleSuppression = -1;
                  var10 = carPlayActive;
               }
            }

            if (var10) {
               Mhi2qAaClusterComposition.setClusterProjectionEnabled(var9 != 1);
               if (var9 == 1) {
                  Mhi2qAaClusterComposition.setTurnCardVisible(false, 0);
               }
            }

            return;
         }

         var7.setInt(9000, 1, var4);
         if (var7.getInt(9000, 1, -1) != var4) {
            throw new IllegalStateException("VC preference write not visible");
         }

         synchronized (Mhi2qAaNavProxy.class) {
            if (vcPreferenceRevision == var3) {
               vcPersistedRevision = var3;
            }

            vcStorageRetryAfter = 0L;
         }
      } catch (Throwable var18) {
         synchronized (Mhi2qAaNavProxy.class) {
            vcStorageRetryAfter = var5 + 5000L;
         }

         Log.w("VCMenu", "preference storage unavailable: " + var18);
      }
   }

   private static synchronized void tick() {
      pollVcMenuTestCommand(System.currentTimeMillis());
      renderer.connect();
      int var0 = rendererConnectionRevision;
      if (var0 != lastRendererConnectionRevision) {
         presentationToken = 0;
         lastRenderedSequence = -1;
         lastRendererConnectionRevision = var0;
      }

      enforceVcMenuView();
      resolveInfrastructure();
      if (!carPlayActive) {
         if (sessionStarted) {
            stopSession();
         } else if (oemResyncPending || gate != null && gate.isBlocked()) {
            releaseBapToOem();
         }

         if (deactivationRequested) {
            deactivationRequested = false;
            prepareOemMapImage();

            try {
               renderer.sendClear();
            } catch (Throwable var15) {
            }

            Mhi2qAaClusterComposition.setTurnCardVisible(false, 0);
            log("MHI2Q AA OEM state restored after disconnect");
         }
      } else {
         setOemMapPresentation(oemMapShouldBeVisible(carPlayActive, vcActiveMode));
         if (!wantsProjectedBap() && sessionStarted) {
            Mhi2qAaClusterComposition.setTurnCardVisible(false, 0);
            Mhi2qAaClusterComposition.setVcMenuVisible(false, 0);
            if (!Mhi2qAaClusterComposition.isProjectionReleased()) {
               return;
            }

            stopSession();
         } else if (!wantsProjectedBap() && (oemResyncPending || gate != null && gate.isBlocked())) {
            releaseBapToOem();
         }

         refresh();
         boolean var1 = routeDataIsAvailable();
         boolean var2 = vcMenuRequested || vcMenuClosing;
         if (vcMenuRequested && renderer.isReady() && (wantsProjectedBap() || Mhi2qAaClusterComposition.isProjectionReleased())) {
            renderer.sendVcMenu(true, vcMenuSelection, vcActiveMode, vcMenuToken);
            Mhi2qAaClusterComposition.setTurnCardVisible(false, 0);
            Mhi2qAaClusterComposition.setVcMenuVisible(renderer.isFrameReady(), renderer.isFrameReady() ? vcMenuToken : 0);
         } else if (vcMenuClosing) {
            Mhi2qAaClusterComposition.setTurnCardVisible(false, 0);
            Mhi2qAaClusterComposition.setVcMenuVisible(false, 0);
            if (Mhi2qAaClusterComposition.isVcMenuVisibilityApplied(false)) {
               renderer.sendVcMenu(false, vcMenuSelection, vcActiveMode, 0);
               vcMenuClosing = false;
               vcMenuToken = 0;
               lastRenderedSequence = -1;
            }
         }

         if (wantsProjectedBap()) {
            if (rawService != null) {
               if (!sessionStarted && !startSession(var1)) {
                  return;
               }

               boolean var3 = var1 && projectedCardsEnabled() && shouldOpenTurnCard();
               if (var3 != turnCardWindowOpen) {
                  turnCardWindowOpen = var3;
                  lastPublishedSequence = -1;
                  lastRenderedSequence = -1;
                  presentationToken = 0;
                  log("MHI2Q AA turn card window " + (var3 ? "opened" : "closed") + " eta=" + timeToStepSeconds + "s distance=" + distanceMeters + "m");
               }

               if (turnCardWindowOpen && !var2 && sequence != lastRenderedSequence && publishRendererSnapshot()) {
                  lastRenderedSequence = sequence;
               }
            } else if (sessionStarted) {
               stopSession();
            }

            boolean var19 = renderer.isFrameReady();
            int var4 = rendererStateRevision;
            boolean var5 = false;
            var0 = rendererConnectionRevision;
            if (var0 != lastRendererConnectionRevision) {
               presentationToken = 0;
               lastRenderedSequence = -1;
               lastRendererConnectionRevision = var0;
               var5 = true;
            }

            boolean var6 = var4 != lastRendererStateRevision;
            if (var6 || var19 != rendererHadFrame) {
               lastPublishedSequence = -1;
               if (!var19) {
                  lastRenderedSequence = -1;
               }
            }

            boolean var7 = var1 && !var5 && isCardPresented(sessionStarted, turnCardWindowOpen, var19, maneuver) && !var2;
            boolean var8 = clusterCardAvailable && !var7;
            boolean var9 = rgStatusPublicationRequired(publishedRgStatus, var7, true);
            boolean var10 = cardPublicationRequired(publishedCardOpen, var7);
            boolean var11 = routePublicationRequired(publishedRouteDataAvailable, var1);
            if (sessionStarted && var8 && (var9 || var10 || var11)) {
               try {
                  publishSnapshot(false, var1, true);
                  lastPublishedSequence = sequence;
               } catch (Throwable var17) {
                  failOpen();
                  var7 = false;
               }
            }

            if (var8) {
               Mhi2qAaClusterComposition.setTurnCardVisible(false, 0);
            }

            boolean var12 = closeCanCommit(var8, Mhi2qAaClusterComposition.isTurnCardVisibilityApplied(false));
            boolean var13 = shouldForcePresentationEdge(var7, rendererHadFrame, var6);
            if (sessionStarted && !var8 && (sequence != lastPublishedSequence || var9 || var10 || var11)) {
               try {
                  publishSnapshot(var7, var1, true);
                  lastPublishedSequence = sequence;
               } catch (Throwable var16) {
                  failOpen();
                  var7 = false;
               }
            }

            rendererHadFrame = var19;
            lastRendererStateRevision = var4;
            if (sessionStarted && var12) {
               setClusterCardAvailable(var7);
            }

            if (var13) {
               Mhi2qAaClusterComposition.setTurnCardVisible(false, 0);
            }

            if (var2) {
               Mhi2qAaClusterComposition.setTurnCardVisible(false, 0);
            } else if (!var8) {
               Mhi2qAaClusterComposition.setTurnCardVisible(var7, var7 ? presentationToken : 0);
            }
         }
      }
   }

   private static boolean isCardPresented(boolean var0, boolean var1, boolean var2, int var3) {
      return var0 && var1 && var2 && var3 != 0;
   }

   private static boolean shouldForcePresentationEdge(boolean var0, boolean var1, boolean var2) {
      return var0 && var1 && var2;
   }

   private static boolean closeCanCommit(boolean var0, boolean var1) {
      return !var0 || var1;
   }

   private static boolean isRendererConnectionBoundary(String var0) {
      return "connected".equals(var0)
         || "disconnected".equals(var0)
         || "send-failed".equals(var0)
         || "disconnect-request".equals(var0)
         || "disposed".equals(var0);
   }

   private static boolean shouldOpenTurnCard() {
      return TurnCardPolicy.shouldOpen(timeToStepSeconds, distanceMeters, maneuver, turnCardWindowOpen);
   }

   private static void resolveInfrastructure() {
      if (rawService == null && serviceManager != null) {
         try {
            ServiceReference[] var0 = serviceManager.getServiceReferences(CombiBAPServiceNavi.class);
            if (var0 != null) {
               for (int var1 = 0; var1 < var0.length; var1++) {
                  Object var2 = serviceManager.getService(var0[var1]);
                  if (var2 instanceof CombiBAPServiceNavi) {
                     serviceReference = var0[var1];
                     rawService = (CombiBAPServiceNavi)var2;
                     gate = new Mhi2qAaGatedCombiService(rawService);
                     appliedMapScaleSuppression = -1;
                     gate.setBlocked(wantsProjectedBap() || sessionStarted);
                     lastPublishedSequence = -1;
                     log("MHI2Q AA BAP OSGi service acquired");
                     break;
                  }
               }
            }
         } catch (Throwable var4) {
         }
      }

      if (rawService != null && gate != null && !installScheduled) {
         try {
            Navigation var5 = Navigation.getInstance();
            if (var5 == null) {
               return;
            }

            DispatcherBase var6 = var5.getDispatcher();
            if (var6 == null) {
               return;
            }

            installScheduled = true;
            var6.execute(new Mhi2qAaNavProxy$3());
         } catch (Throwable var3) {
            installScheduled = false;
         }
      }
   }

   private static synchronized void installGateOnNavigationJobs() {
      installScheduled = false;

      try {
         Navigation var0 = Navigation.getInstance();
         if (var0 == null) {
            return;
         }

         ClusterService var1 = var0.getClusterService();
         if (var1 == null || rawService == null) {
            return;
         }

         CombiBAPServiceNavi var2 = var1.getCombiBAPListenerCombiService();
         if (var2 == gate) {
            if (cluster != var1) {
               appliedMapScaleSuppression = -1;
            }

            cluster = var1;
            return;
         }

         if (var2 instanceof Mhi2qAaGatedCombiService) {
            gate = (Mhi2qAaGatedCombiService)var2;
            rawService = gate.getRealService();
            appliedMapScaleSuppression = -1;
         } else if (var2 != null) {
            rawService = var2;
            gate = new Mhi2qAaGatedCombiService(rawService);
            appliedMapScaleSuppression = -1;
         }

         if (gate == null) {
            return;
         }

         if (cluster != var1) {
            appliedMapScaleSuppression = -1;
         }

         cluster = var1;
         distanceFormatter = new BAPDistanceFormatter(var1.getMhi2qAaLogChannel());
         gate.setBlocked(wantsProjectedBap() || sessionStarted);
         var1.setCombiBAPListenerCombiService(gate);
         log("MHI2Q AA BAP gate installed on NavigationJobs");
      } catch (Throwable var3) {
      }
   }

   public static synchronized void onOemRgActive(boolean var0) {
      if (sessionStarted) {
         previousRgActive = var0;
      }
   }

   private static boolean wantsProjectedBap() {
      return carPlayActive && projectedCardsEnabled();
   }

   static synchronized void enforceVcMenuView() {
      if (!Mhi2qAaClusterComposition.isLargeView()) {
         closeVcSettingsMenu();
      }
   }

   private static boolean startSession(boolean var0) {
      if (cluster != null && rawService != null && gate != null) {
         try {
            previousRgActive = cluster.getDSIResponseContainer().isRgActive();
            publishedRgStatus = -1;
            publishedCardOpen = -1;
            publishedRouteDataAvailable = -1;
            gate.setBlocked(true);
            cluster.getDSIResponseContainer().setRgActive(true);
            forceClusterCardUnavailable(true);
            publishSnapshot(false, var0, true);
            sessionStarted = true;
            lastPublishedSequence = sequence;
            lastRenderedSequence = -1;
            turnCardWindowOpen = false;
            log("MHI2Q AA BAP ownership started route=" + var0);
            return true;
         } catch (Throwable var2) {
            rollbackStart();
            return false;
         }
      } else {
         return false;
      }
   }

   private static void publishSnapshot(boolean var0, boolean var1, boolean var2) throws Exception {
      int var3 = rgStatusForPresentation(var0, var2);
      boolean var4 = rgStatusPublicationRequired(publishedRgStatus, var0, var2);
      boolean var5 = cardPublicationRequired(publishedCardOpen, var0);
      boolean var6 = routePublicationRequired(publishedRouteDataAvailable, var1);
      boolean var7 = var4 || var5 || var6;
      if (var7) {
         rawService.updateRGStatus(var3);
         rawService.updateActiveRGType(0);
      }

      if (var0) {
         int[] var8 = ManeuverMapper.bapDescriptor(maneuver, roundaboutAngle);
         sendDescriptor(var8[0], var8[1]);
      } else {
         sendDescriptor(0, 0);
      }

      int var12 = TurnCardPolicy.actionThreshold(maneuver);
      boolean var9 = distanceMeters >= 0 && distanceMeters <= var12;
      int var10 = 0;
      if (var9 && var12 > 0) {
         var10 = distanceMeters * 100 / var12;
         if (var10 < 0) {
            var10 = 0;
         }

         if (var10 > 100) {
            var10 = 100;
         }
      }

      if (var0) {
         int[] var11 = formatDistance(distanceMeters);
         rawService.updateDistanceToNextManeuver(var11[0], var11[1], var9, var10);
      } else {
         rawService.updateDistanceToNextManeuver(-1, 0, false, 0);
      }

      int[] var13 = var1 ? formatDestinationDistance(destinationDistanceMeters) : new int[]{-1, 0};
      rawService.updateDistanceToDestination(var13[0], var13[1], false);
      rawService.updateTimeToDestination(0, 0, var1 ? timeToDestinationSeconds : -1L);
      rawService.updateCurrentPositionInfo(var1 ? choosePositionText() : "");
      rawService.updateTurnToInfo(turnToTextForCard(var0), "");
      rawService.updateManeuverState(maneuverStateForCard(var0, var9));
      sendExitView();
      if (var7) {
         publishedRgStatus = var3;
         publishedCardOpen = var0 ? 1 : 0;
         publishedRouteDataAvailable = var1 ? 1 : 0;
      }
   }

   private static int rgStatusForPresentation(boolean var0, boolean var1) {
      return var1 && var0 ? 1 : 0;
   }

   private static boolean rgStatusPublicationRequired(int var0, boolean var1, boolean var2) {
      return var0 != rgStatusForPresentation(var1, var2);
   }

   private static boolean cardPublicationRequired(int var0, boolean var1) {
      return var0 != (var1 ? 1 : 0);
   }

   private static boolean routePublicationRequired(int var0, boolean var1) {
      return var0 != (var1 ? 1 : 0);
   }

   private static int maneuverStateForCard(boolean var0, boolean var1) {
      return TurnCardPolicy.bapManeuverState(var0, var1);
   }

   private static boolean publishRendererSnapshot() {
      if (!renderer.isReady()) {
         return false;
      }

      int[] var0 = ManeuverMapper.rendererManeuver(maneuver, roundaboutAngle, roundaboutExit);
      if (!rendererManeuverHasContent(var0)) {
         presentationToken = 0;
         return renderer.sendClear();
      }

      if (presentationToken == 0) {
         presentationToken = allocatePresentationToken();
      }

      int var1 = TurnCardPolicy.actionThreshold(maneuver);
      boolean var2 = distanceMeters >= 0 && distanceMeters <= var1 && var1 > 0;
      int var3 = 0;
      if (var2) {
         var3 = distanceMeters * 16 / var1;
         if (var3 < 0) {
            var3 = 0;
         }

         if (var3 > 16) {
            var3 = 16;
         }
      }

      boolean var4 = renderer.sendManeuver(
         var0[0], var0[1], var0[2], var0[3], null, laneGuidance, roundaboutExit, var0[4] != 0, var3, var2 ? 1 : 0, 1, presentationToken
      );
      if (var4) {
         log("MHI2Q AA turn card type=" + maneuver + " icon=" + var0[0] + " direction=" + var0[1] + " angle=" + var0[2]);
      }

      return var4;
   }

   private static boolean rendererManeuverHasContent(int[] var0) {
      return var0 != null && var0.length > 0 && var0[0] != 0;
   }

   private static int allocatePresentationToken() {
      presentationTokenCounter = nextPresentationTokenForTest(presentationTokenCounter);
      return presentationTokenCounter;
   }

   private static void stopSession() {
      try {
         if (gate != null) {
            gate.setBlocked(true);
         }
      } catch (Throwable var4) {
      }

      publishedRgStatus = -1;
      publishedCardOpen = -1;
      publishedRouteDataAvailable = -1;

      try {
         if (rawService != null) {
            publishSnapshot(false, false, false);
         }
      } catch (Throwable var3) {
      }

      try {
         if (cluster != null) {
            forceClusterCardUnavailable(false);
         }
      } catch (Throwable var2) {
      }

      restoreClusterState();
      sessionStarted = false;
      publishedRgStatus = -1;
      publishedCardOpen = -1;
      publishedRouteDataAvailable = -1;
      lastPublishedSequence = -1;
      lastRenderedSequence = -1;
      turnCardWindowOpen = false;
      clusterCardAvailable = false;
      presentationToken = 0;

      try {
         renderer.sendClear();
      } catch (Throwable var1) {
      }

      Mhi2qAaClusterComposition.setTurnCardVisible(false, 0);
      releaseBapToOem();
      log("MHI2Q AA BAP session stopped");
   }

   private static void rollbackStart() {
      publishedRgStatus = -1;
      publishedCardOpen = -1;
      publishedRouteDataAvailable = -1;

      try {
         if (rawService != null) {
            publishSnapshot(false, false, false);
         }
      } catch (Throwable var3) {
      }

      try {
         if (cluster != null) {
            forceClusterCardUnavailable(false);
         }
      } catch (Throwable var2) {
      }

      restoreClusterState();
      sessionStarted = false;
      publishedRgStatus = -1;
      publishedCardOpen = -1;
      publishedRouteDataAvailable = -1;
      lastPublishedSequence = -1;
      lastRenderedSequence = -1;
      turnCardWindowOpen = false;
      clusterCardAvailable = false;
      presentationToken = 0;

      try {
         renderer.sendClear();
      } catch (Throwable var1) {
      }

      Mhi2qAaClusterComposition.setTurnCardVisible(false, 0);
      releaseBapToOem();
      log("MHI2Q AA BAP start rolled back");
   }

   private static synchronized void failOpen() {
      if (sessionStarted) {
         stopSession();
      } else {
         try {
            if (gate != null) {
               gate.setBlocked(false);
            }
         } catch (Throwable var1) {
         }
      }
   }

   private static void restoreClusterState() {
      try {
         if (cluster != null) {
            cluster.getDSIResponseContainer().setRgActive(previousRgActive);
            cluster.updateRgActive(previousRgActive);
            cluster.updateRGIString(cluster.getDSIResponseContainer().getRGIString());
         }
      } catch (Throwable var1) {
      }
   }

   private static void releaseBapToOem() {
      boolean var0 = oemResyncPending;
      oemResyncPending = true;

      try {
         if (gate != null) {
            gate.setBlocked(false);
         }
      } catch (Throwable var2) {
      }

      try {
         if (cluster != null) {
            cluster.resyncMhi2qAaCombiBAP();
            oemResyncPending = false;
         }
      } catch (Throwable var3) {
         if (!var0) {
            log("MHI2Q OEM BAP replay pending: " + var3);
         }
      }
   }

   private static void prepareOemMapImage() {
      setOemMapPresentation(true);
   }

   private static void setOemMapPresentation(boolean var0) {
      setMapScaleSuppressed(!var0 || vcMenuRequested || vcMenuClosing);
   }

   private static void setMapScaleSuppressed(boolean var0) {
      int var1 = var0 ? 1 : 0;
      if (gate != null && appliedMapScaleSuppression != var1) {
         try {
            gate.setMapScaleBlocked(var0);
            if (!var0 && cluster != null) {
               cluster.resyncMhi2qAaCombiBAP();
            }

            appliedMapScaleSuppression = var1;
            log("MHI2Q AA OEM map scale " + (var0 ? "neutralized" : "restored"));
         } catch (Throwable var3) {
         }
      }
   }

   public static void acknowledgeProjectedMapScaleInput(CombiBAPServiceNavi var0) {
      try {
         if (var0 instanceof Mhi2qAaGatedCombiService) {
            var0 = ((Mhi2qAaGatedCombiService)var0).getRealService();
         }

         if (var0 != null) {
            var0.updateMapScale(0, false, 0, 0, false);
         }
      } catch (Throwable var2) {
      }
   }

   private static boolean oemMapShouldBeVisible(boolean var0, int var1) {
      return !var0 || var1 == 1;
   }

   private static boolean projectedCardsEnabled() {
      return vcActiveMode == 0;
   }

   private static void setClusterCardAvailable(boolean var0) {
      if (cluster != null && clusterCardTransitionRequired(clusterCardAvailable, var0)) {
         try {
            if (var0) {
               cluster.updateRGIString(new short[]{1});
            } else {
               cluster.setKDKVisibility(false);
            }

            clusterCardAvailable = var0;
         } catch (Throwable var2) {
         }
      }
   }

   private static void forceClusterCardUnavailable(boolean var0) {
      cluster.setKDKVisibility(false);
      cluster.updateRGIString(var0 ? new short[]{1} : null);
      clusterCardAvailable = false;
   }

   private static boolean clusterCardTransitionRequired(boolean var0, boolean var1) {
      return var0 != var1;
   }

   private static void sendDescriptor(int var0, int var1) {
      CombiBAPNaviManeuverDescriptor[] var2 = new CombiBAPNaviManeuverDescriptor[]{new CombiBAPNaviManeuverDescriptor(var0, var1, 0, new byte[0])};
      rawService.updateManeuverDescriptor(var2);
   }

   private static void sendExitView() {
      exitViewSendCount++;
      rawService.updateExitView((exitViewSendCount & 1) == 0 ? 0 : 1, 0);
   }

   private static int[] formatDistance(int var0) {
      return formatDistance(var0, false);
   }

   private static int[] formatDestinationDistance(int var0) {
      return formatDistance(var0, true);
   }

   private static int[] formatDistance(int var0, boolean var1) {
      int[] var2 = new int[]{-1, 0};
      if (var0 >= 0 && distanceFormatter != null) {
         try {
            int var3 = Distance.getSystemUnit();
            boolean var4 = var3 == 1 || var3 == 5 || var3 == 6;
            BAPDistance var5 = var1 ? distanceFormatter.formatDistanceToDestination(var0, var4) : distanceFormatter.formatDistanceToTurn(var0, var4);
            Class var6 = var5.getClass();
            var2[0] = (Integer)var6.getMethod("getValue").invoke(var5);
            var2[1] = (Integer)var6.getMethod("getUnit").invoke(var5);
         } catch (Throwable var7) {
            var2[0] = -1;
            var2[1] = 0;
         }

         return var2;
      } else {
         return var2;
      }
   }

   private static String choosePositionText() {
      if (currentRoad != null && currentRoad.length() > 0) {
         return currentRoad;
      } else if (nextRoad != null && nextRoad.length() > 0) {
         return nextRoad;
      } else {
         return instruction != null && instruction.length() > 0 ? instruction : "↑";
      }
   }

   private static String chooseTurnToText() {
      if (nextRoad != null && nextRoad.length() > 0) {
         return nextRoad;
      } else {
         return instruction != null && instruction.length() > 0 ? instruction : "";
      }
   }

   private static String turnToTextForCard(boolean var0) {
      return var0 ? chooseTurnToText() : "";
   }

   private static boolean routeDataIsAvailable() {
      boolean var0 = "aa".equals(mode) || "carplay".equals(mode);
      if (var0 && updated > 0L) {
         if (!navigationStateClaimed) {
            if (!NavigationStateReader.isFresh(mode, active, updated, System.currentTimeMillis())) {
               return false;
            }

            navigationStateClaimed = true;
         }

         return active;
      } else {
         return false;
      }
   }

   private static void refresh() {
      NavigationSnapshot var0 = stateReader.refresh(false);
      mode = var0.mode;
      sequence = var0.sequence;
      updated = var0.updated;
      active = var0.active;
      maneuver = var0.maneuver;
      roundaboutExit = var0.roundaboutExit;
      roundaboutAngle = var0.roundaboutAngle;
      distanceMeters = var0.distanceMeters;
      timeToStepSeconds = var0.timeToStepSeconds;
      destinationDistanceMeters = var0.destinationDistanceMeters;
      timeToDestinationSeconds = var0.timeToDestinationSeconds;
      currentRoad = var0.currentRoad;
      nextRoad = var0.nextRoad;
      instruction = var0.instruction;
      laneGuidance = var0.laneGuidance;
   }

   private static void log(String var0) {
   }

   public static synchronized void resetForTest() {
      mode = "shadow";
      sequence = -1;
      updated = 0L;
      active = false;
      destinationDistanceMeters = -1;
      laneGuidance = new byte[0];
      timeToDestinationSeconds = -1;
      sessionStarted = false;
      oemResyncPending = false;
      carPlayActive = true;
      deactivationRequested = false;
      appliedMapScaleSuppression = -1;
      publishedRgStatus = -1;
      publishedCardOpen = -1;
      publishedRouteDataAvailable = -1;
      navigationStateClaimed = false;
      lastPublishedSequence = -1;
      lastRenderedSequence = -1;
      rendererHadFrame = false;
      rendererStateRevision = 0;
      lastRendererStateRevision = 0;
      rendererConnectionRevision = 0;
      lastRendererConnectionRevision = 0;
      turnCardWindowOpen = false;
      clusterCardAvailable = false;
      presentationTokenCounter = 0;
      presentationToken = 0;
      vcMenuRequested = false;
      vcMenuClosing = false;
      vcMenuSelection = 0;
      vcActiveMode = 0;
      vcMenuToken = 0;
      vcMenuTestDeadline = 0L;
      vcStorageFramework = null;
      vcStorageForTest = null;
      vcPreferenceLoaded = false;
      vcPreferenceRevision = 0;
      vcPersistedRevision = 0;
      vcStorageRetryAfter = 0L;
      stateReader.resetForTest("shadow");
   }

   static synchronized void setVcStorageForTest(IStorageAccess var0) {
      vcStorageForTest = var0;
   }

   static void syncVcPreferenceForTest() {
      syncVcPreference();
   }

   public static synchronized boolean overrideIsFreshForTest() {
      refresh();
      return routeDataIsAvailable();
   }

   public static synchronized int[] destinationStateForTest() {
      return new int[]{destinationDistanceMeters, timeToDestinationSeconds};
   }

   public static int[] maneuverDescriptorForTest(int var0, int var1) {
      return ManeuverMapper.bapDescriptor(var0, var1);
   }

   public static int[] rendererManeuverForTest(int var0, int var1, int var2) {
      return ManeuverMapper.rendererManeuver(var0, var1, var2);
   }

   public static synchronized boolean turnCardWindowForTest(int var0, int var1, int var2, boolean var3) {
      int var4 = timeToStepSeconds;
      int var5 = distanceMeters;
      int var6 = maneuver;
      boolean var7 = turnCardWindowOpen;
      timeToStepSeconds = var0;
      distanceMeters = var1;
      maneuver = var2;
      turnCardWindowOpen = var3;
      boolean var8 = shouldOpenTurnCard();
      timeToStepSeconds = var4;
      distanceMeters = var5;
      maneuver = var6;
      turnCardWindowOpen = var7;
      return var8;
   }

   public static int maneuverStateForCardForTest(boolean var0, boolean var1) {
      return maneuverStateForCard(var0, var1);
   }

   public static boolean rendererManeuverHasContentForTest(int var0, int var1, int var2) {
      return rendererManeuverHasContent(ManeuverMapper.rendererManeuver(var0, var1, var2));
   }

   public static boolean cardPresentedForTest(boolean var0, boolean var1, boolean var2, int var3) {
      return isCardPresented(var0, var1, var2, var3);
   }

   public static boolean forcePresentationEdgeForTest(boolean var0, boolean var1, boolean var2) {
      return shouldForcePresentationEdge(var0, var1, var2);
   }

   public static boolean closeCanCommitForTest(boolean var0, boolean var1) {
      return closeCanCommit(var0, var1);
   }

   public static int nextPresentationTokenForTest(int var0) {
      int var1 = var0 + 1;
      return var1 == 0 ? 1 : var1;
   }

   public static int wrapMenuSelectionForTest(int var0, int var1) {
      int var2 = (var0 + var1) % 2;
      return var2 < 0 ? var2 + 2 : var2;
   }

   public static boolean oemMapShouldBeVisibleForTest(boolean var0, int var1) {
      return oemMapShouldBeVisible(var0, var1);
   }

   public static boolean projectedCardsEnabledForTest() {
      return projectedCardsEnabled();
   }

   public static int retainPresentationTokenForTest(int var0, int var1) {
      return var0 == 0 ? var1 : var0;
   }

   public static boolean presentationTokenMatchesForTest(int var0, int var1) {
      return var0 != 0 && var1 != 0 && var0 == var1;
   }

   public static boolean clusterCardTransitionRequiredForTest(boolean var0, boolean var1) {
      return clusterCardTransitionRequired(var0, var1);
   }

   public static synchronized String turnToTextForCardForTest(boolean var0) {
      return turnToTextForCard(var0);
   }

   public static int rgStatusForPresentationForTest(boolean var0, boolean var1) {
      return rgStatusForPresentation(var0, var1);
   }

   public static boolean rgStatusPublicationRequiredForTest(int var0, boolean var1, boolean var2) {
      return rgStatusPublicationRequired(var0, var1, var2);
   }

   public static boolean cardPublicationRequiredForTest(int var0, boolean var1) {
      return cardPublicationRequired(var0, var1);
   }

   public static boolean routePublicationRequiredForTest(int var0, boolean var1) {
      return routePublicationRequired(var0, var1);
   }

   static {
      renderer.setStateListener(new Mhi2qAaNavProxy$1());
      Mhi2qAaClusterComposition.setPresentationListener(new Mhi2qAaNavProxy$2());
   }
}
```

</details>

### Source 11: renderer transport

Original path: `reverse-engineered/java-vineflower/com/nicolas/carplay/rgd/RendererServer.java`

<details id="source-11">
<summary>Read complete source</summary>

<!-- source-file: reverse-engineered/java-vineflower/com/nicolas/carplay/rgd/RendererServer.java; terminal-newline: yes -->

```java
/* Reconstructed by Vineflower 1.12.0; not original source. */package com.nicolas.carplay.rgd;

import com.nicolas.carplay.framework.Log;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;

public class RendererServer {
   private static final String TAG = "RendererServer";
   private static final String HOST = "127.0.0.1";
   private static final int PORT = 19800;
   private static final int PKT_SIZE = 48;
   private static final int WRITE_QUEUE_CAPACITY = 32;
   private static final int SOCKET_READ_TIMEOUT_MS = 5000;
   private static final byte EVT_HEARTBEAT = -128;
   private static final byte EVT_READY = -127;
   private static final byte EVT_FRAME_READY = -126;
   private static final byte EVT_FRAME_CLEARED = -125;
   private static final byte CMD_MANEUVER = 1;
   private static final byte CMD_BARGRAPH = 6;
   private static final byte CMD_CLEAR = 7;
   private static final byte CMD_PRESENTED = 8;
   private static final byte CMD_VC_MENU = 9;
   private static final byte CMD_LANE_GUIDANCE = 10;
   private static final byte MAN_FLAG_SET_PERSP = 1;
   private static final byte MAN_FLAG_BARGRAPH = 2;
   private static final byte MAN_FLAG_ROUNDABOUT_ANGLE_VALID = 4;
   private final Object lock = new Object();
   private final Object writeLock = new Object();
   private ServerSocket server;
   private Socket sock;
   private OutputStream out;
   private Thread acceptThread;
   private Thread writerThread;
   private volatile boolean running;
   private volatile boolean rendererReady;
   private volatile boolean frameReady;
   private volatile boolean clearPending;
   private volatile int menuPresentationToken;
   private volatile boolean everConnected;
   private volatile RendererServer.StateListener stateListener;
   private long lastBindFailureLogMs;
   private int suppressedBindFailures;
   private int connectionGeneration;
   private final RendererServer.PendingWrite[] writeQueue = new RendererServer.PendingWrite[32];
   private int writeHead;
   private int writeTail;
   private int writeCount;

   public void setStateListener(RendererServer.StateListener var1) {
      this.stateListener = var1;
   }

   public boolean connect() {
      synchronized (this.lock) {
         if (this.server != null && !this.server.isClosed()) {
            return true;
         }

         ServerSocket var2 = null;

         try {
            var2 = new ServerSocket();
            var2.setReuseAddress(true);
            var2.bind(new InetSocketAddress("127.0.0.1", 19800));
            this.server = var2;
            this.running = true;
            Log.i("RendererServer", "listening on 127.0.0.1:19800");
         } catch (IOException var7) {
            if (var2 != null) {
               try {
                  var2.close();
               } catch (IOException var6) {
               }
            }

            this.logBindFailure(var7);
            return false;
         }

         this.acceptThread = new Thread(new RendererServer$1(this), "RendererServer-Accept");
         this.acceptThread.setDaemon(true);
         this.acceptThread.start();
         this.writerThread = new Thread(new RendererServer$2(this), "RendererServer-Write");
         this.writerThread.setDaemon(true);
         this.writerThread.start();
         return true;
      }
   }

   private void logBindFailure(IOException var1) {
      long var2 = System.currentTimeMillis();
      if (this.lastBindFailureLogMs != 0L && var2 - this.lastBindFailureLogMs < 10000L) {
         this.suppressedBindFailures++;
      } else {
         String var4 = this.suppressedBindFailures > 0 ? " (" + this.suppressedBindFailures + " repeats suppressed)" : "";
         Log.w("RendererServer", "bind failed: " + var1.getMessage() + var4);
         this.lastBindFailureLogMs = var2;
         this.suppressedBindFailures = 0;
      }
   }

   private void acceptLoop() {
      ServerSocket var1;
      synchronized (this.lock) {
         var1 = this.server;
      }

      while (this.running && var1 != null && !var1.isClosed()) {
         try {
            Socket var16 = var1.accept();

            try {
               var16.setTcpNoDelay(true);
               var16.setSoTimeout(5000);
               OutputStream var17 = var16.getOutputStream();
               InputStream var4 = var16.getInputStream();
               synchronized (this.lock) {
                  if (this.sock != null) {
                     try {
                        this.sock.close();
                     } catch (Exception var10) {
                     }
                  }

                  this.sock = var16;
                  this.out = var17;
                  this.connectionGeneration++;
                  this.clearWriteQueue();
                  this.everConnected = true;
                  this.rendererReady = false;
                  this.frameReady = false;
                  this.clearPending = false;
                  this.menuPresentationToken = 0;
                  this.lock.notifyAll();
               }

               Log.i("RendererServer", "renderer connected from " + var16.getInetAddress() + ":" + var16.getPort());
               this.notifyStateChanged("connected");
               Thread var18 = new Thread(new RendererServer$3(this, var16, var4), "RendererServer-Read");
               var18.setDaemon(true);
               var18.start();
            } catch (IOException var14) {
               try {
                  var16.close();
               } catch (Exception var9) {
               }
            }
         } catch (IOException var15) {
            if (this.running) {
            }

            synchronized (this.lock) {
               if (this.server == null || this.server.isClosed()) {
                  break;
               }
            }
         }
      }

      Log.i("RendererServer", "accept thread exiting");
   }

   private void writerLoop() {
      while (true) {
         label88: {
            RendererServer.PendingWrite var1;
            synchronized (this.writeLock) {
               while (this.running && this.writeCount == 0) {
                  try {
                     this.writeLock.wait();
                  } catch (InterruptedException var7) {
                  }
               }

               if (!this.running) {
                  break label88;
               }

               var1 = this.writeQueue[this.writeHead];
               this.writeQueue[this.writeHead] = null;
               this.writeHead = (this.writeHead + 1) % 32;
               this.writeCount--;
            }

            OutputStream var12;
            synchronized (this.lock) {
               if (this.out == null || var1 == null || var1.generation != this.connectionGeneration) {
                  continue;
               }

               var12 = this.out;
            }

            try {
               var12.write(var1.packet);
               var12.flush();
            } catch (Exception var9) {
               Log.w("RendererServer", "Writer failed: " + var9.getMessage());
               boolean var4 = false;
               synchronized (this.lock) {
                  if (this.out == var12) {
                     this.closeClientLocked();
                     var4 = true;
                  }
               }

               if (var4) {
                  this.notifyStateChanged("send-failed");
               }
            }
            continue;
         }

         Log.i("RendererServer", "writer thread exiting");
         return;
      }
   }

   private void clearWriteQueue() {
      synchronized (this.writeLock) {
         for (int var2 = 0; var2 < 32; var2++) {
            this.writeQueue[var2] = null;
         }

         this.writeHead = 0;
         this.writeTail = 0;
         this.writeCount = 0;
         this.writeLock.notifyAll();
      }
   }

   private void readerLoop(Socket var1, InputStream var2) {
      byte[] var3 = new byte[48];

      try {
         while (this.running) {
            int var4 = 0;

            while (var4 < 48) {
               int var5 = var2.read(var3, var4, 48 - var4);
               if (var5 < 0) {
                  throw new IOException("EOF");
               }

               var4 += var5;
            }

            this.handleRendererEvent(var1, var3[0]);
         }
      } catch (IOException var18) {
         if (this.running) {
            Log.i("RendererServer", "reader exit: " + var18.getClass().getName() + (var18.getMessage() == null ? "" : " " + var18.getMessage()));
         }
      } finally {
         boolean var9 = false;
         synchronized (this.lock) {
            if (this.sock == var1) {
               this.closeClientLocked();
               var9 = true;
            }
         }

         if (var9) {
            this.notifyStateChanged("disconnected");
         }
      }
   }

   private void notifyStateChanged(String var1) {
      RendererServer.StateListener var2 = this.stateListener;
      if (var2 != null) {
         try {
            var2.onRendererStateChanged(var1);
         } catch (Throwable var4) {
            Log.w("RendererServer", "state listener failed: " + var4.getMessage());
         }
      }
   }

   private void handleRendererEvent(Socket var1, byte var2) {
      boolean var3 = false;
      String var4 = null;
      synchronized (this.lock) {
         if (this.sock != var1) {
            return;
         }

         if (var2 == -127) {
            var3 = !this.rendererReady;
            this.rendererReady = true;
            this.lock.notifyAll();
            var4 = "ready";
         } else if (var2 == -126) {
            this.rendererReady = true;
            if (!this.clearPending) {
               var3 = !this.frameReady;
               this.frameReady = true;
               this.lock.notifyAll();
               var4 = "frame-ready";
            }
         } else if (var2 == -125) {
            var3 = this.clearPending || this.frameReady;
            this.clearPending = false;
            this.frameReady = false;
            this.lock.notifyAll();
            var4 = "frame-cleared";
         }
      }

      if (var3) {
         Log.i("RendererServer", "renderer " + var4);
         this.notifyStateChanged(var4);
      }
   }

   public void disconnectClient() {
      boolean var1;
      synchronized (this.lock) {
         var1 = this.sock != null || this.rendererReady || this.frameReady || this.clearPending;
         this.closeClientLocked();
      }

      if (var1) {
         this.notifyStateChanged("disconnect-request");
      }
   }

   public void dispose() {
      synchronized (this.lock) {
         this.running = false;
         this.everConnected = false;
         this.closeClientLocked();
         if (this.server != null) {
            try {
               this.server.close();
            } catch (Exception var8) {
            }

            this.server = null;
         }
      }

      this.clearWriteQueue();
      if (this.acceptThread != null) {
         try {
            this.acceptThread.join(500L);
         } catch (InterruptedException var7) {
         }

         this.acceptThread = null;
      }

      synchronized (this.writeLock) {
         this.writeLock.notifyAll();
      }

      if (this.writerThread != null) {
         try {
            this.writerThread.join(500L);
         } catch (InterruptedException var5) {
         }

         this.writerThread = null;
      }

      this.notifyStateChanged("disposed");
   }

   private void closeClientLocked() {
      if (this.out != null) {
         try {
            this.out.close();
         } catch (Exception var3) {
         }

         this.out = null;
      }

      if (this.sock != null) {
         try {
            this.sock.close();
         } catch (Exception var2) {
         }

         this.sock = null;
      }

      this.connectionGeneration++;
      this.clearWriteQueue();
      this.rendererReady = false;
      this.frameReady = false;
      this.clearPending = false;
      this.menuPresentationToken = 0;
      this.lock.notifyAll();
   }

   public boolean isConnected() {
      synchronized (this.lock) {
         return this.sock != null && !this.sock.isClosed() && this.out != null;
      }
   }

   public boolean isReady() {
      synchronized (this.lock) {
         return this.sock != null && !this.sock.isClosed() && this.out != null && this.rendererReady;
      }
   }

   public boolean isFrameReady() {
      synchronized (this.lock) {
         return this.sock != null && !this.sock.isClosed() && this.out != null && this.frameReady && !this.clearPending;
      }
   }

   public boolean everConnected() {
      return this.everConnected;
   }

   public boolean sendManeuver(int var1, int var2, int var3, int var4, int[] var5, int var6, int var7, int var8, int var9) {
      return this.sendManeuver(var1, var2, var3, var4, var5, null, 0, false, var6, var7, var8, var9);
   }

   public boolean sendManeuver(
      int var1, int var2, int var3, int var4, int[] var5, byte[] var6, int var7, boolean var8, int var9, int var10, int var11, int var12
   ) {
      byte[] var13 = new byte[48];
      var13[0] = 1;
      byte var14 = 0;
      if (var10 > 0) {
         var14 = (byte)(var14 | 2);
      }

      if (var11 >= 0) {
         var14 = (byte)(var14 | 1);
      }

      if (var8) {
         var14 = (byte)(var14 | 4);
      }

      var13[1] = var14;
      var13[2] = (byte)(var1 & 0xFF);
      var13[3] = (byte)var2;
      var13[4] = (byte)(var3 >> 8 & 0xFF);
      var13[5] = (byte)(var3 & 0xFF);
      var13[6] = (byte)(var4 & 0xFF);
      int var15 = 0;
      if (var5 != null) {
         var15 = var5.length;
         if (var15 > 16) {
            var15 = 16;
         }
      }

      var13[7] = (byte)(var15 & 0xFF);

      for (int var16 = 0; var16 < var15; var16++) {
         int var17 = 8 + var16 * 2;
         if (var17 + 1 >= 48) {
            break;
         }

         int var18 = var5[var16];
         var13[var17] = (byte)(var18 >> 8 & 0xFF);
         var13[var17 + 1] = (byte)(var18 & 0xFF);
      }

      var13[40] = (byte)(var12 >> 24 & 0xFF);
      var13[41] = (byte)(var12 >> 16 & 0xFF);
      var13[42] = (byte)(var12 >> 8 & 0xFF);
      var13[43] = (byte)(var12 & 0xFF);
      if (var7 < 0) {
         var7 = 0;
      }

      if (var7 > 99) {
         var7 = 99;
      }

      var13[44] = (byte)(var7 & 0xFF);
      if (var11 >= 0) {
         var13[45] = (byte)(var11 & 0xFF);
      }

      if (var10 > 0) {
         var13[46] = (byte)(var9 & 0xFF);
         var13[47] = (byte)(var10 & 0xFF);
      }

      byte[] var19 = buildLanePacket(var6, var12);
      return this.sendPackets(new byte[][]{var19, var13}, false);
   }

   private static byte[] buildLanePacket(byte[] var0, int var1) {
      byte[] var2 = new byte[48];
      var2[0] = 10;
      var2[2] = (byte)(var1 >> 24 & 0xFF);
      var2[3] = (byte)(var1 >> 16 & 0xFF);
      var2[4] = (byte)(var1 >> 8 & 0xFF);
      var2[5] = (byte)(var1 & 0xFF);
      var2[7] = 105;
      if (var0 != null && var0.length != 0) {
         int var3 = var0[0] & 255;
         int var4 = validateLaneGuidance(var0, var3);
         if (var4 == 0) {
            return var2;
         }

         var2[6] = (byte)var3;
         System.arraycopy(var0, 1, var2, 8, var4 - 1);
         var2[40] = (byte)(var4 - 1);
         return var2;
      } else {
         return var2;
      }
   }

   static byte[] lanePacketForTest(byte[] var0, int var1) {
      return buildLanePacket(var0, var1);
   }

   private static int validateLaneGuidance(byte[] var0, int var1) {
      if (var1 >= 1 && var1 <= 8 && var0.length <= 33) {
         int var2 = 1;

         for (int var3 = 0; var3 < var1; var3++) {
            if (var2 >= var0.length) {
               return 0;
            }

            int var4 = var0[var2++] & 255;
            if (var4 < 1 || var4 > 3 || var2 + var4 > var0.length) {
               return 0;
            }

            int var5 = 0;

            for (int var6 = 0; var6 < var4; var6++) {
               int var7 = var0[var2++] & 255;
               if ((var7 & 112) != 0 || (var7 & 15) > 9) {
                  return 0;
               }

               if ((var7 & 128) != 0) {
                  if (++var5 > 1) {
                     return 0;
                  }
               }
            }
         }

         return var2 == var0.length ? var2 : 0;
      } else {
         return 0;
      }
   }

   public boolean sendBargraph(int var1, int var2) {
      byte[] var3 = new byte[48];
      var3[0] = 6;
      var3[2] = (byte)(var1 & 0xFF);
      var3[3] = (byte)(var2 & 0xFF);
      return this.sendPacket(var3);
   }

   public boolean sendClear() {
      byte[] var1 = new byte[48];
      var1[0] = 7;
      return this.sendPacket(var1, true);
   }

   public boolean sendPresented(int var1, int var2, int var3, int var4, int var5) {
      byte[] var6 = new byte[48];
      var6[0] = 8;
      var6[2] = (byte)(var1 >> 24 & 0xFF);
      var6[3] = (byte)(var1 >> 16 & 0xFF);
      var6[4] = (byte)(var1 >> 8 & 0xFF);
      var6[5] = (byte)(var1 & 0xFF);
      putU16(var6, 6, var2);
      putU16(var6, 8, var3);
      putU16(var6, 10, var4);
      putU16(var6, 12, var5);
      return this.sendPacket(var6);
   }

   public boolean sendVcMenu(boolean var1, int var2, int var3, int var4) {
      byte[] var5 = new byte[48];
      var5[0] = 9;
      var5[2] = (byte)(var1 ? 1 : 0);
      var5[3] = (byte)(var2 & 0xFF);
      var5[4] = (byte)(var3 & 0xFF);
      var5[5] = 0;
      var5[6] = (byte)(var4 >> 24 & 0xFF);
      var5[7] = (byte)(var4 >> 16 & 0xFF);
      var5[8] = (byte)(var4 >> 8 & 0xFF);
      var5[9] = (byte)(var4 & 0xFF);
      boolean var6;
      synchronized (this.lock) {
         var6 = !var1 || var4 != this.menuPresentationToken;
         this.menuPresentationToken = var1 ? var4 : 0;
      }

      return this.sendPacket(var5, var6);
   }

   private static void putU16(byte[] var0, int var1, int var2) {
      if (var2 < 0) {
         var2 = 0;
      }

      if (var2 > 65535) {
         var2 = 65535;
      }

      var0[var1] = (byte)(var2 >> 8 & 0xFF);
      var0[var1 + 1] = (byte)(var2 & 0xFF);
   }

   private boolean sendPacket(byte[] var1) {
      return this.sendPacket(var1, false);
   }

   private boolean sendPacket(byte[] var1, boolean var2) {
      return this.sendPackets(new byte[][]{var1}, var2);
   }

   private boolean sendPackets(byte[][] var1, boolean var2) {
      int var3;
      synchronized (this.lock) {
         if (this.out == null) {
            return false;
         }

         var3 = this.connectionGeneration;
         if (var2) {
            this.frameReady = false;
            this.clearPending = true;
            this.lock.notifyAll();
         }
      }

      synchronized (this.writeLock) {
         for (int var5 = 0; var5 < var1.length; var5++) {
            RendererServer.PendingWrite var6 = new RendererServer.PendingWrite(null);
            var6.packet = var1[var5];
            var6.generation = var3;
            if (this.writeCount == 32) {
               this.writeQueue[this.writeHead] = null;
               this.writeHead = (this.writeHead + 1) % 32;
               this.writeCount--;
            }

            this.writeQueue[this.writeTail] = var6;
            this.writeTail = (this.writeTail + 1) % 32;
            this.writeCount++;
         }

         this.writeLock.notifyAll();
         return true;
      }
   }

   private static final class PendingWrite {
      byte[] packet;
      int generation;

      private PendingWrite() {
      }
   }

   public interface StateListener {
      void onRendererStateChanged(String var1);
   }
}
```

</details>

### Source 12: Cluster composition

Original path: `reverse-engineered/java-vineflower/com/nicolas/carplay/core/Mhi2qAaClusterComposition.java`

<details id="source-12">
<summary>Read complete source</summary>

<!-- source-file: reverse-engineered/java-vineflower/com/nicolas/carplay/core/Mhi2qAaClusterComposition.java; terminal-newline: yes -->

```java
/* Reconstructed by Vineflower 1.12.0; not original source. */package com.nicolas.carplay.core;

import com.nicolas.carplay.framework.Log;
import de.audi.app.terminalmode.IContext;
import de.audi.atip.hmi.HMIService;
import de.audi.atip.hmi.HMITerminal;
import de.audi.atip.hmi.model.HMIModel;
import de.audi.atip.hmi.modelaccess.ChoiceModelGUI;
import de.audi.atip.hmi.view.IDisplayManager;
import de.audi.tghu.hmi.evo.HMITerminalEvo;
import de.esolutions.hmi.widgets.audi.base.HMITerminalImpl;
import de.esolutions.hmi.widgets.audi.base.Layout;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import org.dsi.ifc.displaymanagement.DSIDisplayManagement;
import org.dsi.ifc.displaymanagement.DisplayContext;
import org.osgi.framework.BundleContext;
import org.osgi.framework.ServiceReference;

public final class Mhi2qAaClusterComposition implements Runnable {
   public static final int TERMINAL_CLUSTER = 1;
   public static final int CONTEXT_AA = 70;
   private static final int DISPLAYABLE_TURN = 98;
   private static final int BACKING_IN_TUBE = 101;
   private static final int BACKING_POPUP = 102;
   private static final int VIEW_SMALL = 1;
   private static final long RECONCILE_MS = 100L;
   private static final long REASSERT_RETRY_MS = 1000L;
   private static final long TURN_DISPLAY_SHOW_DELAY_MS = 600L;
   private static final long TURN_DISPLAY_HIDE_DELAY_MS = 500L;
   private static final String NATIVE_REASSERT_REQUEST = "/tmp/mhi2q_aa_context70.request";
   private static final String UI_VIEW_STATE = "/tmp/mhi2q_aa_ui_view.state";
   private static final int UI_VIEW_LARGE = 76;
   private static final int UI_VIEW_CLASSIC_SMALL = 67;
   private static final int UI_VIEW_SPORT_SMALL = 83;
   private static final int LC_IN_TUBE_X = 58;
   private static final int LC_IN_TUBE_Y = 59;
   private static final int LC_POPUP_X = 60;
   private static final int LC_POPUP_Y = 61;
   private static final int LC_POPUP_CROP_X = 118;
   private static final int LC_POPUP_CROP_Y = 119;
   private static final int LC_POPUP_CROP_W = 120;
   private static final int LC_POPUP_CROP_H = 121;
   private static final int LC_IN_TUBE_CROP_X = 122;
   private static final int LC_IN_TUBE_CROP_Y = 123;
   private static final int LC_IN_TUBE_CROP_W = 124;
   private static final int LC_IN_TUBE_CROP_H = 125;
   private static final Object LOCK = new Object();
   private static IContext context;
   private static IDisplayManager displayManager;
   private static Thread worker;
   private static volatile boolean androidAutoActive;
   private static volatile boolean nativeContextReady;
   private static volatile boolean ownershipRequested;
   private static volatile boolean owningCluster;
   private static volatile boolean clusterProjectionEnabled = true;
   private static volatile boolean turnCardVisible;
   private static volatile int turnCardToken;
   private static volatile Mhi2qAaClusterComposition.PresentationListener presentationListener;
   private static volatile boolean menuVisible;
   private static volatile int menuToken;
   private static volatile int menuRevision;
   private static volatile int viewSize = 2;
   private static volatile boolean viewSizeKnown;
   private static int oemMenuContext = -1;
   private static int[] oemMenuLayers;
   private static volatile int skin;
   private static int appliedViewSize = -1;
   private static int appliedSkin = -1;
   private static int appliedGeometryRevision = -1;
   private static volatile int appliedTurnCardRevision = -1;
   private static volatile int appliedTurnCardToken;
   private static int notifiedTurnCardRevision = -1;
   private static int notifiedTurnCardToken;
   private static int notifiedSourceX = -1;
   private static int notifiedSourceY = -1;
   private static int notifiedSourceWidth = -1;
   private static int notifiedSourceHeight = -1;
   private static volatile boolean appliedTurnCardVisible;
   private static volatile boolean appliedMenuVisible;
   private static volatile int appliedMenuRevision = -1;
   private static volatile int appliedMenuToken;
   private static int notifiedMenuRevision = -1;
   private static int notifiedMenuToken;
   private static volatile int loggedContext = Integer.MIN_VALUE;
   private static boolean reassertPending;
   private static long lastReassertRequestMs;
   private static int publishedUiViewState = -1;
   private static int geometryRevision;
   private static long turnDisplayShowDeadlineMs;
   private static long turnDisplayHideDeadlineMs;
   private static volatile int turnCardRevision;
   private static int inTubeX = 1055;
   private static int inTubeY = 207;
   private static int inTubeCropX = 59;
   private static int inTubeCropY = 27;
   private static int inTubeCropW = 210;
   private static int inTubeCropH = 153;
   private static int popupX = 1091;
   private static int popupY = 110;
   private static int popupCropX = 59;
   private static int popupCropY = 27;
   private static int popupCropW = 210;
   private static int popupCropH = 153;
   private static String layoutName = "fallback-classic";

   private Mhi2qAaClusterComposition() {
   }

   public static void setPresentationListener(Mhi2qAaClusterComposition.PresentationListener var0) {
      synchronized (LOCK) {
         presentationListener = var0;
         notifiedTurnCardRevision = -1;
         notifiedMenuRevision = -1;
         notifiedSourceX = -1;
         LOCK.notifyAll();
      }
   }

   public static void prepare(Object var0) {
      if (var0 instanceof IContext) {
         synchronized (LOCK) {
            context = (IContext)var0;
            ensureWorkerLocked();
            LOCK.notifyAll();
         }
      }
   }

   public static void onActivate(Object var0) {
      prepare(var0);
      synchronized (LOCK) {
         androidAutoActive = true;
         clusterProjectionEnabled = true;
         nativeContextReady = false;
         reassertPending = false;
         ensureWorkerLocked();
         LOCK.notifyAll();
      }
   }

   public static void onDeactivate() {
      synchronized (LOCK) {
         androidAutoActive = false;
         nativeContextReady = false;
         reassertPending = false;
         ownershipRequested = false;
         clusterProjectionEnabled = true;
         if (turnCardVisible || turnCardToken != 0) {
            turnCardVisible = false;
            turnCardToken = 0;
            turnCardRevision++;
         }

         turnDisplayShowDeadlineMs = 0L;
         if (menuVisible || menuToken != 0) {
            menuVisible = false;
            menuToken = 0;
            menuRevision++;
         }

         try {
            new File("/tmp/mhi2q_aa_context70.request").delete();
         } catch (Throwable var3) {
         }

         LOCK.notifyAll();
      }
   }

   public static void setTurnCardVisible(boolean var0, int var1) {
      synchronized (LOCK) {
         int var3 = var0 ? var1 : 0;
         if (turnCardVisible != var0 || turnCardToken != var3) {
            boolean var4 = var0 && !turnCardVisible && !appliedTurnCardVisible;
            turnDisplayShowDeadlineMs = nextTurnCardShowDeadline(var4, var0, turnDisplayShowDeadlineMs, System.currentTimeMillis());
            turnCardVisible = var0;
            turnCardToken = var3;
            turnCardRevision++;
            if (var4) {
               Log.w("AAComposition", "turn overlay open delayed 600ms after BAP");
            }

            LOCK.notifyAll();
         }
      }
   }

   public static boolean isTurnCardVisibilityApplied(boolean var0) {
      synchronized (LOCK) {
         return turnCardVisible == var0
            && appliedTurnCardVisible == var0
            && appliedTurnCardRevision == turnCardRevision
            && appliedTurnCardToken == (var0 ? turnCardToken : 0);
      }
   }

   public static void setVcMenuVisible(boolean var0, int var1) {
      synchronized (LOCK) {
         var0 = var0 && isLargeView();
         int var3 = var0 ? var1 : 0;
         if (menuVisible != var0 || menuToken != var3) {
            menuVisible = var0;
            menuToken = var3;
            menuRevision++;
            LOCK.notifyAll();
         }
      }
   }

   public static boolean isVcMenuVisibilityApplied(boolean var0) {
      synchronized (LOCK) {
         return menuVisible == var0 && appliedMenuVisible == var0 && appliedMenuRevision == menuRevision && appliedMenuToken == (var0 ? menuToken : 0);
      }
   }

   public static void setClusterProjectionEnabled(boolean var0) {
      synchronized (LOCK) {
         if (clusterProjectionEnabled != var0) {
            clusterProjectionEnabled = var0;
            reassertPending = false;
            LOCK.notifyAll();
         }
      }
   }

   public static boolean isClusterProjectionEnabled() {
      return clusterProjectionEnabled;
   }

   public static void onViewSize(int var0) {
      int var1 = var0 == 1 ? 1 : 2;
      synchronized (LOCK) {
         viewSizeKnown = var0 == 1 || var0 == 2;
         if (viewSize != var1) {
            viewSize = var1;
            LOCK.notifyAll();
         }
      }
   }

   public static boolean isLargeView() {
      return viewSizeKnown && viewSize == 2;
   }

   public static boolean isProjectionReleased() {
      return !owningCluster && !ownershipRequested && loggedContext != Integer.MIN_VALUE && loggedContext != 70;
   }

   public static void onSkin(int var0) {
      synchronized (LOCK) {
         if (skin != var0) {
            skin = var0;
            LOCK.notifyAll();
         }
      }
   }

   public static boolean shouldBlockStockContextWrite() {
      return wantsCustomContext();
   }

   public static boolean shouldPinStockClusterContext() {
      return wantsCustomContext();
   }

   private static boolean wantsCustomContext() {
      return androidAutoActive && clusterProjectionEnabled;
   }

   public static boolean isContextWriterThread() {
      return Thread.currentThread() == worker;
   }

   public static boolean isOwningCluster() {
      return owningCluster;
   }

   private static void ensureWorkerLocked() {
      if (worker == null || !worker.isAlive()) {
         Thread var0 = new Thread(new Mhi2qAaClusterComposition(), "MHI2Q-AA-VC-Composition");
         var0.setDaemon(true);

         try {
            var0.start();
            worker = var0;
         } catch (Throwable var2) {
            worker = null;
            Log.w("AAComposition", "worker start failed: " + var2);
         }
      }
   }

   public void run() {
      while (true) {
         try {
            reconcile();
         } catch (Throwable var6) {
            Log.w("AAComposition", "reconcile failed: " + var6);
         }

         synchronized (LOCK) {
            try {
               LOCK.wait(100L);
            } catch (InterruptedException var4) {
            }
         }
      }
   }

   private static void reconcile() {
      boolean var0 = androidAutoActive;
      boolean var1 = wantsCustomContext();
      IDisplayManager var2 = resolveDisplayManager();
      if (var2 == null) {
         OemClusterMapRenderGate.request(false);
      } else {
         refreshOemViewState();
         if (!isLargeView()) {
            setVcMenuVisible(false, 0);
         }

         int var3 = -1;

         try {
            var3 = var2.getCurrentContextID(1);
         } catch (Throwable var7) {
         }

         boolean var4 = OemClusterMapRenderGate.request(var1 && var3 == 70);
         publishUiViewState(var3);
         if (var3 != loggedContext) {
            loggedContext = var3;
            Log.w("AAComposition", "active=" + var0 + " native-context=" + var3);
         }

         if (var0 && var3 == 70) {
            nativeContextReady = true;
            if (reassertPending) {
               reassertPending = false;
               appliedViewSize = -1;
               appliedSkin = -1;
               appliedGeometryRevision = -1;
               Log.w("AAComposition", "native context 70 restored");
            }
         }

         if (!var1) {
            ownershipRequested = false;
            if (owningCluster && var3 >= 0 && var3 != 70) {
               owningCluster = false;
               reassertPending = false;
               Log.w("AAComposition", "OEM cluster map restored");
            }

            if (var3 == 70) {
               setVcMenuVisible(false, 0);
               applyLayers(var2);
               if (!isTurnCardVisibilityApplied(false) || !isVcMenuVisibilityApplied(false)) {
                  return;
               }

               if (!var4) {
                  return;
               }

               long var9 = System.currentTimeMillis();
               if (!reassertPending || var9 - lastReassertRequestMs >= 1000L) {
                  reassertPending = requestNativeContext(79);
                  lastReassertRequestMs = var9;
               }
            } else {
               applyOemMenu(var2, var3);
            }
         } else if (restoreOemMenuContext()) {
            if (var3 != 70) {
               ownershipRequested = nativeContextReady;
               if (nativeContextReady) {
                  owningCluster = true;
               }

               long var8 = System.currentTimeMillis();
               if (!reassertPending || var8 - lastReassertRequestMs >= 1000L) {
                  reassertPending = requestNativeContext(67);
                  lastReassertRequestMs = var8;
                  Log.w("AAComposition", "context drift " + var3 + " -> native reassert " + 70 + " requested=" + reassertPending);
               }

               if (nativeContextReady) {
                  applyLayers(var2);
               }
            } else {
               boolean var5 = var3 == 70;
               if (var5) {
                  ownershipRequested = true;
                  if (!owningCluster) {
                     owningCluster = true;
                     appliedViewSize = -1;
                     appliedSkin = -1;
                     appliedGeometryRevision = -1;
                     Log.w("AAComposition", "native context 70 acquired: {98,101,102,3}");
                  }

                  applyLayers(var2);
               } else if (!var1 && owningCluster) {
                  ownershipRequested = false;
                  hideLayers(var2);
                  owningCluster = false;
                  appliedViewSize = -1;
                  appliedSkin = -1;
                  appliedGeometryRevision = -1;
                  Log.w("AAComposition", "native context 70 released");
               } else {
                  ownershipRequested = false;
               }
            }
         }
      }
   }

   private static void applyOemMenu(IDisplayManager var0, int var1) {
      if (var1 >= 0 && var1 != 70) {
         boolean var2 = androidAutoActive && menuVisible && isLargeView();
         int var3 = menuRevision;
         int var4 = menuToken;
         if (!var2 && !appliedMenuVisible && oemMenuContext < 0) {
            appliedMenuRevision = var3;
            appliedMenuToken = 0;
            appliedTurnCardVisible = false;
            appliedTurnCardRevision = turnCardRevision;
            appliedTurnCardToken = 0;
            notifyVcMenuHidden(var3);
         } else if (oemMenuContext == var1 || restoreOemMenuContext()) {
            if (var2 && oemMenuContext < 0) {
               int[] var5 = var0.getDisplayables(var1);
               if (var5 == null || var5.length == 0) {
                  return;
               }

               int[] var6 = prependMenuLayer(var5);
               if (!declareOemContext(var1, var6)) {
                  return;
               }

               oemMenuLayers = (int[])var5.clone();
               oemMenuContext = var1;
            }

            var0.lockDisplayAndWait(1);

            try {
               if (var2) {
                  var0.setCropping(98, 1, 0, 0, 328, 180, 449, 87, 541, 297);
               }

               var0.setOpacity(98, 1, var2 ? 100 : 0);
            } finally {
               var0.unlockDisplayAndWait(1);
            }

            if (var0.getOpacity(98, 1) == (var2 ? 100 : 0)) {
               if (var2 || restoreOemMenuContext()) {
                  appliedMenuVisible = var2;
                  appliedMenuRevision = var3;
                  appliedMenuToken = var2 ? var4 : 0;
                  appliedTurnCardVisible = false;
                  appliedTurnCardRevision = turnCardRevision;
                  appliedTurnCardToken = 0;
                  if (var2) {
                     notifyVcMenuPresented(var3, var4, 0, 0, 328, 180);
                  } else {
                     notifyVcMenuHidden(var3);
                  }
               }
            }
         }
      }
   }

   static int[] prependMenuLayer(int[] var0) {
      int var1 = 0;

      for (int var2 = 0; var2 < var0.length; var2++) {
         if (var0[var2] != 98) {
            var1++;
         }
      }

      int[] var5 = new int[var1 + 1];
      var5[0] = 98;
      int var3 = 1;

      for (int var4 = 0; var4 < var0.length; var4++) {
         if (var0[var4] != 98) {
            var5[var3++] = var0[var4];
         }
      }

      return var5;
   }

   private static boolean restoreOemMenuContext() {
      if (oemMenuContext < 0) {
         return true;
      }

      if (!declareOemContext(oemMenuContext, oemMenuLayers)) {
         return false;
      }

      oemMenuContext = -1;
      oemMenuLayers = null;
      return true;
   }

   private static boolean declareOemContext(int var0, int[] var1) {
      IContext var2 = context;
      if (var2 != null && var2.getFramework() != null) {
         BundleContext var3 = var2.getFramework().getBundleCxt();
         if (var3 == null) {
            return false;
         }

         ServiceReference var4 = var3.getServiceReference(DSIDisplayManagement.class.getName());
         if (var4 == null) {
            return false;
         }

         try {
            Object var5 = var3.getService(var4);
            if (!(var5 instanceof DSIDisplayManagement)) {
               return false;
            }

            ((DSIDisplayManagement)var5).declareContexts(new DisplayContext[]{new DisplayContext(var0, var1)});
            return true;
         } finally {
            var3.ungetService(var4);
         }
      } else {
         return false;
      }
   }

   private static boolean requestNativeContext(int var0) {
      FileOutputStream var1 = null;

      try {
         var1 = new FileOutputStream("/tmp/mhi2q_aa_context70.request", false);
         var1.write(var0);
         var1.flush();
         return true;
      } catch (Throwable var13) {
         Log.w("AAComposition", "native context request failed: " + var13);
         return false;
      } finally {
         if (var1 != null) {
            try {
               var1.close();
            } catch (Throwable var12) {
            }
         }
      }
   }

   private static void publishUiViewState(int var0) {
      int var1 = uiSnapshotForTest(viewSize, skin, clusterProjectionEnabled, var0, publishedUiViewState);
      if (publishedUiViewState != var1) {
         try {
            writeUiViewState(new File("/tmp/mhi2q_aa_ui_view.state"), var1);
            publishedUiViewState = var1;
            Log.w(
               "AAComposition",
               "AA UI view="
                  + ((var1 & 0xFF) == 83 ? "sport-left" : ((var1 & 0xFF) == 67 ? "classic-large-gauges" : "large-center"))
                  + " projection="
                  + (var1 >>> 8 == 80)
            );
         } catch (Throwable var3) {
            Log.w("AAComposition", "AA UI view publish failed: " + var3);
         }
      }
   }

   static int uiSnapshotForTest(int var0, int var1, boolean var2, int var3, int var4) {
      boolean var5 = var2 || var3 == 70 || var3 < 0 && (var4 < 0 || var4 >>> 8 != 79);
      return uiViewStateForTest(var0, var1) | (var5 ? 80 : 79) << 8;
   }

   static void writeUiViewState(File var0, int var1) throws IOException {
      FileOutputStream var2 = new FileOutputStream(var0, false);

      try {
         var2.write(new byte[]{(byte)var1, (byte)(var1 >>> 8)});
      } finally {
         var2.close();
      }
   }

   private static IDisplayManager resolveDisplayManager() {
      IDisplayManager var0 = displayManager;
      if (var0 != null) {
         return var0;
      }

      IContext var1 = context;
      if (var1 == null) {
         return null;
      }

      try {
         if (var1.getFramework() == null || var1.getFramework().getHMIService() == null) {
            return null;
         }

         var0 = var1.getFramework().getHMIService().getDisplayManager();
         if (var0 != null) {
            displayManager = var0;
         }
      } catch (Throwable var3) {
      }

      return var0;
   }

   private static void refreshOemViewState() {
      IContext var0 = context;
      if (var0 != null && var0.getFramework() != null) {
         try {
            HMIService var1 = var0.getFramework().getHMIService();
            if (var1 == null) {
               return;
            }

            HMIModel var2 = var1.getModel(402521);
            if (!(var2 instanceof ChoiceModelGUI)) {
               return;
            }

            int var3 = ((ChoiceModelGUI)var2).getValue();
            int var4 = var3 == 1 ? 1 : 2;
            int var5 = skin;
            Layout var6 = null;
            HMITerminal var7 = var1.getHMITerminal(0);
            if (var7 instanceof HMITerminalEvo) {
               var5 = ((HMITerminalEvo)var7).getSkin();
            }

            if (var7 instanceof HMITerminalImpl) {
               var6 = ((HMITerminalImpl)var7).getLayout();
            }

            int var8 = inTubeX;
            int var9 = inTubeY;
            int var10 = inTubeCropX;
            int var11 = inTubeCropY;
            int var12 = inTubeCropW;
            int var13 = inTubeCropH;
            int var14 = popupX;
            int var15 = popupY;
            int var16 = popupCropX;
            int var17 = popupCropY;
            int var18 = popupCropW;
            int var19 = popupCropH;
            String var20 = layoutName;
            if (var6 != null) {
               var8 = var6.getIntegerConstant(58);
               var9 = var6.getIntegerConstant(59);
               var10 = var6.getIntegerConstant(122);
               var11 = var6.getIntegerConstant(123);
               var12 = var6.getIntegerConstant(124);
               var13 = var6.getIntegerConstant(125);
               var14 = var6.getIntegerConstant(60);
               var15 = var6.getIntegerConstant(61);
               var16 = var6.getIntegerConstant(118);
               var17 = var6.getIntegerConstant(119);
               var18 = var6.getIntegerConstant(120);
               var19 = var6.getIntegerConstant(121);
               var20 = var6.getClass().getName();
            }

            synchronized (LOCK) {
               viewSizeKnown = var3 == 1 || var3 == 2;
               boolean var22 = inTubeX != var8
                  || inTubeY != var9
                  || inTubeCropX != var10
                  || inTubeCropY != var11
                  || inTubeCropW != var12
                  || inTubeCropH != var13
                  || popupX != var14
                  || popupY != var15
                  || popupCropX != var16
                  || popupCropY != var17
                  || popupCropW != var18
                  || popupCropH != var19
                  || !layoutName.equals(var20);
               boolean var23 = viewSize != var4 || skin != var5;
               if (!var22 && !var23) {
                  return;
               }

               viewSize = var4;
               skin = var5;
               if (var22) {
                  inTubeX = var8;
                  inTubeY = var9;
                  inTubeCropX = var10;
                  inTubeCropY = var11;
                  inTubeCropW = var12;
                  inTubeCropH = var13;
                  popupX = var14;
                  popupY = var15;
                  popupCropX = var16;
                  popupCropY = var17;
                  popupCropW = var18;
                  popupCropH = var19;
                  layoutName = var20;
                  geometryRevision++;
               }

               Log.w("AAComposition", "VC view model=" + var3 + " skin=" + skin + " layout=" + layoutName);
            }
         } catch (Throwable var26) {
            Log.w("AAComposition", "VC view/Layout read failed: " + var26);
         }
      }
   }

   private static void applyLayers(IDisplayManager var0) {
      int var1 = viewSize;
      int var2 = skin;
      int var3 = geometryRevision;
      boolean var4;
      int var5;
      int var6;
      boolean var7;
      int var8;
      int var9;
      synchronized (LOCK) {
         var4 = turnCardVisible;
         var5 = turnCardRevision;
         var6 = turnCardToken;
         var7 = menuVisible;
         var8 = menuRevision;
         var9 = menuToken;
      }

      if (var7) {
         byte var18 = 0;
         byte var19 = 0;
         short var20 = 328;
         short var21 = 180;
         if (!appliedMenuVisible || appliedMenuRevision != var8 || appliedMenuToken != var9 || !layerOpacitiesMatch(var0, 100, 0, 0)) {
            if (!setGeometry(var0, var18, var19, var20, var21, 449, 87, 541, 297, -1)) {
               return;
            }

            appliedMenuVisible = true;
            appliedMenuRevision = var8;
            appliedMenuToken = var9;
            appliedTurnCardVisible = false;
         }

         notifyVcMenuPresented(var8, var9, var18, var19, var20, var21);
      } else {
         boolean var17 = appliedMenuVisible;
         int var11 = var1 != 1 ? popupCropX : inTubeCropX;
         int var12 = var1 != 1 ? popupCropY : inTubeCropY;
         int var13 = var1 != 1 ? popupCropW : inTubeCropW;
         int var14 = var1 != 1 ? popupCropH : inTubeCropH;
         if (appliedViewSize == var1
            && appliedSkin == var2
            && appliedGeometryRevision == var3
            && appliedTurnCardVisible == var4
            && appliedTurnCardRevision == var5
            && appliedTurnCardToken == var6
            && appliedMenuRevision == var8
            && !appliedMenuVisible
            && layerOpacitiesMatch(var0, var4 ? 100 : 0, var4 && var1 == 1 ? 100 : 0, var4 && var1 != 1 ? 100 : 0)) {
            notifyTurnCardVisibilityApplied(var4, var5, var6, var11, var12, var13, var14);
         } else {
            boolean var15;
            if (!var4) {
               var15 = hideLayers(var0);
            } else {
               if (!turnCardShowCanCommit(var5, var6)) {
                  return;
               }

               if (var1 != 1) {
                  var15 = setGeometry(var0, var11, var12, var13, var14, popupX, popupY, var13, var14, 102);
               } else {
                  var15 = setGeometry(var0, var11, var12, var13, var14, inTubeX, inTubeY, var13, var14, 101);
               }
            }

            if (var15) {
               appliedViewSize = var1;
               appliedSkin = var2;
               appliedGeometryRevision = var3;
               appliedTurnCardVisible = var4;
               appliedTurnCardRevision = var5;
               appliedTurnCardToken = var6;
               appliedMenuVisible = false;
               appliedMenuRevision = var8;
               appliedMenuToken = 0;
               if (var17) {
                  notifyVcMenuHidden(var8);
               }

               notifyTurnCardVisibilityApplied(var4, var5, var6, var11, var12, var13, var14);
            }
         }
      }
   }

   private static boolean turnCardShowCanCommit(int var0, int var1) {
      synchronized (LOCK) {
         if (turnCardVisible && turnCardRevision == var0 && turnCardToken == var1) {
            if (!turnCardShowDelayElapsed(turnDisplayShowDeadlineMs, System.currentTimeMillis())) {
               return false;
            }

            turnDisplayShowDeadlineMs = 0L;
            return true;
         } else {
            return false;
         }
      }
   }

   private static void notifyTurnCardVisibilityApplied(boolean var0, int var1, int var2, int var3, int var4, int var5, int var6) {
      if (var0) {
         notifyTurnCardPresented(var1, var2, var3, var4, var5, var6);
      } else {
         notifyTurnCardHidden(var1);
      }
   }

   private static void notifyTurnCardPresented(int var0, int var1, int var2, int var3, int var4, int var5) {
      Mhi2qAaClusterComposition.PresentationListener var6;
      synchronized (LOCK) {
         if (!presentationIsCurrentLocked(var0, var1)
            || notifiedTurnCardRevision == var0
               && notifiedTurnCardToken == var1
               && notifiedSourceX == var2
               && notifiedSourceY == var3
               && notifiedSourceWidth == var4
               && notifiedSourceHeight == var5) {
            return;
         }

         var6 = presentationListener;
         if (var6 == null) {
            return;
         }
      }

      boolean var13 = false;

      try {
         var13 = var6.onTurnCardPresented(var0, var1, var2, var3, var4, var5);
      } catch (Throwable var11) {
         Log.w("AAComposition", "presentation listener failed: " + var11);
      }

      if (var13) {
         synchronized (LOCK) {
            if (presentationIsCurrentLocked(var0, var1)) {
               notifiedTurnCardRevision = var0;
               notifiedTurnCardToken = var1;
               notifiedSourceX = var2;
               notifiedSourceY = var3;
               notifiedSourceWidth = var4;
               notifiedSourceHeight = var5;
            }
         }
      }
   }

   private static void notifyTurnCardHidden(int var0) {
      Mhi2qAaClusterComposition.PresentationListener var1;
      synchronized (LOCK) {
         if (!hiddenPresentationIsCurrentLocked(var0) || notifiedTurnCardRevision == var0 && notifiedTurnCardToken == 0) {
            return;
         }

         var1 = presentationListener;
         if (var1 == null) {
            return;
         }
      }

      boolean var8 = false;

      try {
         var8 = var1.onTurnCardHidden(var0);
      } catch (Throwable var6) {
         Log.w("AAComposition", "hidden listener failed: " + var6);
      }

      if (var8) {
         synchronized (LOCK) {
            if (hiddenPresentationIsCurrentLocked(var0)) {
               notifiedTurnCardRevision = var0;
               notifiedTurnCardToken = 0;
            }
         }
      }
   }

   private static void notifyVcMenuPresented(int var0, int var1, int var2, int var3, int var4, int var5) {
      Mhi2qAaClusterComposition.PresentationListener var6;
      synchronized (LOCK) {
         if (!menuPresentationIsCurrentLocked(var0, var1) || notifiedMenuRevision == var0 && notifiedMenuToken == var1) {
            return;
         }

         var6 = presentationListener;
         if (var6 == null) {
            return;
         }
      }

      boolean var13 = false;

      try {
         var13 = var6.onVcMenuPresented(var0, var1, var2, var3, var4, var5);
      } catch (Throwable var11) {
         Log.w("AAComposition", "menu presentation listener failed: " + var11);
      }

      if (var13) {
         synchronized (LOCK) {
            if (menuPresentationIsCurrentLocked(var0, var1)) {
               notifiedMenuRevision = var0;
               notifiedMenuToken = var1;
            }
         }
      }
   }

   private static void notifyVcMenuHidden(int var0) {
      Mhi2qAaClusterComposition.PresentationListener var1;
      synchronized (LOCK) {
         if (!hiddenMenuPresentationIsCurrentLocked(var0) || notifiedMenuRevision == var0 && notifiedMenuToken == 0) {
            return;
         }

         var1 = presentationListener;
         if (var1 == null) {
            return;
         }
      }

      boolean var8 = false;

      try {
         var8 = var1.onVcMenuHidden(var0);
      } catch (Throwable var6) {
         Log.w("AAComposition", "menu hidden listener failed: " + var6);
      }

      if (var8) {
         synchronized (LOCK) {
            if (hiddenMenuPresentationIsCurrentLocked(var0)) {
               notifiedMenuRevision = var0;
               notifiedMenuToken = 0;
            }
         }
      }
   }

   private static boolean presentationIsCurrentLocked(int var0, int var1) {
      return var1 != 0
         && turnCardVisible
         && turnCardRevision == var0
         && turnCardToken == var1
         && appliedTurnCardVisible
         && appliedTurnCardRevision == var0
         && appliedTurnCardToken == var1;
   }

   private static boolean hiddenPresentationIsCurrentLocked(int var0) {
      return !turnCardVisible
         && turnCardToken == 0
         && turnCardRevision == var0
         && !appliedTurnCardVisible
         && appliedTurnCardRevision == var0
         && appliedTurnCardToken == 0;
   }

   private static boolean menuPresentationIsCurrentLocked(int var0, int var1) {
      return var1 != 0
         && menuVisible
         && menuRevision == var0
         && menuToken == var1
         && appliedMenuVisible
         && appliedMenuRevision == var0
         && appliedMenuToken == var1;
   }

   private static boolean hiddenMenuPresentationIsCurrentLocked(int var0) {
      return !menuVisible && menuToken == 0 && menuRevision == var0 && !appliedMenuVisible && appliedMenuRevision == var0 && appliedMenuToken == 0;
   }

   private static boolean setGeometry(IDisplayManager var0, int var1, int var2, int var3, int var4, int var5, int var6, int var7, int var8, int var9) {
      turnDisplayHideDeadlineMs = 0L;
      var0.lockDisplayAndWait(1);

      try {
         var0.setCropping(98, 1, var1, var2, var3, var4, var5, var6, var7, var8);
         var0.setOpacity(98, 1, 100);
         if (var9 >= 0) {
            var0.setPosition(var9, 1, var5, var6);
            var0.setOpacity(var9, 1, 100);
            var0.setOpacity(var9 == 102 ? 101 : 102, 1, 0);
         } else {
            var0.setOpacity(101, 1, 0);
            var0.setOpacity(102, 1, 0);
         }
      } finally {
         var0.unlockDisplayAndWait(1);
      }

      if (!layerOpacitiesMatch(var0, 100, var9 == 101 ? 100 : 0, var9 == 102 ? 100 : 0)) {
         return false;
      }

      Log.w(
         "AAComposition",
         "mode="
            + modeName()
            + " layout="
            + layoutName
            + " backing="
            + var9
            + " src="
            + var1
            + ","
            + var2
            + " "
            + var3
            + "x"
            + var4
            + " dst="
            + var5
            + ","
            + var6
            + " "
            + var7
            + "x"
            + var8
      );
      return true;
   }

   private static boolean hideLayers(IDisplayManager var0) {
      long var1 = System.currentTimeMillis();
      if (turnDisplayHideDeadlineMs == 0L) {
         turnDisplayHideDeadlineMs = var1 + 500L;
         Log.w("AAComposition", "complete turn overlay close delayed 500ms");
         return false;
      }

      if (var1 < turnDisplayHideDeadlineMs) {
         return false;
      }

      var0.lockDisplayAndWait(1);

      try {
         var0.setOpacity(98, 1, 0);
         var0.setOpacity(101, 1, 0);
         var0.setOpacity(102, 1, 0);
      } finally {
         var0.unlockDisplayAndWait(1);
      }

      if (!layerOpacitiesMatch(var0, 0, 0, 0)) {
         return false;
      }

      turnDisplayHideDeadlineMs = 0L;
      appliedTurnCardVisible = false;
      appliedMenuVisible = false;
      Log.w("AAComposition", "complete turn overlay close committed");
      return true;
   }

   private static boolean layerOpacitiesMatch(IDisplayManager var0, int var1, int var2, int var3) {
      try {
         return var0.getOpacity(98, 1) == var1 && var0.getOpacity(101, 1) == var2 && var0.getOpacity(102, 1) == var3;
      } catch (Throwable var5) {
         return false;
      }
   }

   private static String modeName() {
      if (viewSize != 1) {
         return "large";
      } else {
         return skin == 1 ? "sport-small" : "classic-small";
      }
   }

   static int[] geometryForTest(int var0, int var1) {
      if (var0 != 1) {
         return new int[]{59, 27, 210, 153, 1091, 110, 102};
      } else {
         return var1 == 1 ? new int[]{0, 0, 328, 180, 984, 139, 101} : new int[]{59, 27, 210, 153, 1055, 207, 101};
      }
   }

   static int uiViewStateForTest(int var0, int var1) {
      if (var0 != 1) {
         return 76;
      } else {
         return var1 == 1 ? 83 : 67;
      }
   }

   static int[] menuGeometryForTest() {
      return new int[]{0, 0, 328, 180, 449, 87, 541, 297};
   }

   static boolean wantsCustomContextForTest(boolean var0, boolean var1, boolean var2) {
      return var0 && var1;
   }

   static int nextTurnCardRevisionForTest(boolean var0, int var1, int var2, boolean var3, int var4) {
      int var5 = var3 ? var4 : 0;
      return var0 == var3 && var1 == var5 ? var2 : var2 + 1;
   }

   static boolean turnCardRequestNeedsApplyForTest(boolean var0, int var1, int var2, boolean var3, int var4, int var5) {
      return var0 != var3 || var1 != var4 || var2 != var5;
   }

   static long nextTurnCardShowDeadline(boolean var0, boolean var1, long var2, long var4) {
      if (!var1) {
         return 0L;
      } else {
         return var0 ? var4 + 600L : var2;
      }
   }

   static boolean turnCardShowDelayElapsed(long var0, long var2) {
      return var0 == 0L || var2 >= var0;
   }

   public interface PresentationListener {
      boolean onTurnCardPresented(int var1, int var2, int var3, int var4, int var5, int var6);

      boolean onTurnCardHidden(int var1);

      boolean onVcMenuPresented(int var1, int var2, int var3, int var4, int var5, int var6);

      boolean onVcMenuHidden(int var1);
   }
}
```

</details>

### Source 13: vehicle geometry

Original path: `reverse-engineered/java-vineflower/com/nicolas/carplay/generated/BridgeVehicleConfig.java`

<details id="source-13">
<summary>Read complete source</summary>

<!-- source-file: reverse-engineered/java-vineflower/com/nicolas/carplay/generated/BridgeVehicleConfig.java; terminal-newline: yes -->

```java
/* Reconstructed by Vineflower 1.12.0; not original source. */package com.nicolas.carplay.generated;

public final class BridgeVehicleConfig {
   public static final boolean LOGGING_ENABLED = false;
   public static final boolean DEV_TOOLS_ENABLED = false;
   public static final String VIN_CHECK_EXECUTABLE = "/eso/bin/apps/mhi2q-aa-cluster-display";
   public static final String TARGET_ID = "mhi2q-p5092";
   public static final int TERMINAL_CLUSTER = 1;
   public static final int CONTEXT_AA = 70;
   public static final int VIEW_SMALL = 1;
   public static final int DISPLAYABLE_TURN = 98;
   public static final int BACKING_IN_TUBE = 101;
   public static final int BACKING_POPUP = 102;
   public static final int PROJECTED_DISPLAYABLE = 3;
   public static final String NATIVE_REASSERT_REQUEST = "/tmp/mhi2q_aa_context70.request";
   public static final String UI_VIEW_STATE = "/tmp/mhi2q_aa_ui_view.state";
   public static final int LC_IN_TUBE_X = 58;
   public static final int LC_IN_TUBE_Y = 59;
   public static final int LC_POPUP_X = 60;
   public static final int LC_POPUP_Y = 61;
   public static final int LC_POPUP_CROP_X = 118;
   public static final int LC_POPUP_CROP_Y = 119;
   public static final int LC_POPUP_CROP_WIDTH = 120;
   public static final int LC_POPUP_CROP_HEIGHT = 121;
   public static final int LC_IN_TUBE_CROP_X = 122;
   public static final int LC_IN_TUBE_CROP_Y = 123;
   public static final int LC_IN_TUBE_CROP_WIDTH = 124;
   public static final int LC_IN_TUBE_CROP_HEIGHT = 125;
   public static final int LARGE_SOURCE_X = 59;
   public static final int LARGE_SOURCE_Y = 27;
   public static final int LARGE_SOURCE_WIDTH = 210;
   public static final int LARGE_SOURCE_HEIGHT = 153;
   public static final int LARGE_DESTINATION_X = 1091;
   public static final int LARGE_DESTINATION_Y = 110;
   public static final int LARGE_BACKING = 102;
   public static final int CLASSIC_SMALL_SOURCE_X = 59;
   public static final int CLASSIC_SMALL_SOURCE_Y = 27;
   public static final int CLASSIC_SMALL_SOURCE_WIDTH = 210;
   public static final int CLASSIC_SMALL_SOURCE_HEIGHT = 153;
   public static final int CLASSIC_SMALL_DESTINATION_X = 1055;
   public static final int CLASSIC_SMALL_DESTINATION_Y = 207;
   public static final int CLASSIC_SMALL_BACKING = 101;
   public static final int SPORT_SMALL_SOURCE_X = 0;
   public static final int SPORT_SMALL_SOURCE_Y = 0;
   public static final int SPORT_SMALL_SOURCE_WIDTH = 328;
   public static final int SPORT_SMALL_SOURCE_HEIGHT = 180;
   public static final int SPORT_SMALL_DESTINATION_X = 984;
   public static final int SPORT_SMALL_DESTINATION_Y = 139;
   public static final int SPORT_SMALL_BACKING = 101;
   public static final int VC_MENU_SOURCE_X = 0;
   public static final int VC_MENU_SOURCE_Y = 0;
   public static final int VC_MENU_SOURCE_WIDTH = 328;
   public static final int VC_MENU_SOURCE_HEIGHT = 180;
   public static final int VC_MENU_DESTINATION_X = 449;
   public static final int VC_MENU_DESTINATION_Y = 87;
   public static final int VC_MENU_DESTINATION_WIDTH = 541;
   public static final int VC_MENU_DESTINATION_HEIGHT = 297;

   private BridgeVehicleConfig() {
   }
}
```

</details>

### Source 14: OEM map gate

Original path: `reverse-engineered/java-vineflower/com/nicolas/carplay/core/OemClusterMapRenderGate.java`

<details id="source-14">
<summary>Read complete source</summary>

<!-- source-file: reverse-engineered/java-vineflower/com/nicolas/carplay/core/OemClusterMapRenderGate.java; terminal-newline: yes -->

```java
/* Reconstructed by Vineflower 1.12.0; not original source. */package com.nicolas.carplay.core;

import com.nicolas.carplay.framework.Log;
import de.audi.tghu.navi.app.Navigation;
import de.audi.tghu.navi.app.map.AbstractMap;
import de.audi.tghu.navi.app.map.dsi.MVRequestControl;
import de.esolutions.fw.util.commons.job.DispatcherBase;

public final class OemClusterMapRenderGate {
   private static OemClusterMapRenderGate.Backend backend = new OemClusterMapRenderGate.NavigationBackend(null);
   private static boolean wanted;
   private static boolean queued;
   private static Object held;
   private static boolean heldDesired;
   private static Object observed;
   private static boolean observedDesired;
   private static long nextCheck;
   private static boolean failureLogged;
   private static boolean restorePending;

   private OemClusterMapRenderGate() {
   }

   public static synchronized boolean filter(Object var0, boolean var1) {
      try {
         if (var0 != null && var0 == held) {
            heldDesired = var1;
         }

         if (var0 != null && var0 == backend.current()) {
            observed = var0;
            observedDesired = var1;
            return wanted && var0 == held ? false : var1;
         } else {
            return var1;
         }
      } catch (Throwable var3) {
         return var1;
      }
   }

   public static synchronized boolean request(boolean var0) {
      if (wanted != var0) {
         nextCheck = 0L;
      }

      wanted = var0;
      if (!wanted && held == null && !queued) {
         return true;
      }

      long var1 = System.currentTimeMillis();
      if (!queued && var1 >= nextCheck) {
         nextCheck = var1 + 1000L;
         queued = true;

         try {
            if (!backend.execute(new OemClusterMapRenderGate$1())) {
               queued = false;
            }
         } catch (Throwable var4) {
            queued = false;
            reportFailure(var4);
         }
      }

      return !wanted && held == null && !queued;
   }

   private static synchronized void reconcile() {
      try {
         try {
            Object var0 = wanted ? backend.current() : null;
            if (held != null && (!wanted || var0 != held || restorePending)) {
               restorePending = true;
               if (!backend.write(held, heldDesired)) {
                  return;
               }

               held = null;
               restorePending = false;
               Log.w("OEMMapRender", "cockpit OEM visibility restored");
            }

            if (wanted && var0 != null && held == null) {
               boolean var1 = var0 == observed ? observedDesired : backend.visible(var0);
               held = var0;
               heldDesired = var1;
               if (!backend.write(var0, false)) {
                  held = null;
                  return;
               }

               restorePending = false;
               Log.w("OEMMapRender", "cockpit OEM rendering suspended");
            }

            failureLogged = false;
         } catch (Throwable var5) {
            restorePending = true;
            reportFailure(var5);
         }
      } finally {
         queued = false;
      }
   }

   private static void reportFailure(Throwable var0) {
      if (!failureLogged) {
         Log.w("OEMMapRender", "visibility retry: " + var0);
      }

      failureLogged = true;
   }

   interface Backend {
      Object current();

      boolean visible(Object var1);

      boolean write(Object var1, boolean var2);

      boolean execute(Runnable var1);
   }

   private static final class NavigationBackend implements OemClusterMapRenderGate.Backend {
      private NavigationBackend() {
      }

      public Object current() {
         Navigation var1 = Navigation.getInstance();
         if (var1 != null && var1.getMapManager() != null) {
            AbstractMap var2 = var1.getMapManager().getMapKombi();
            return var2 != null && var2.isInitialized() && var2.getMVRequest() != null ? var2.getMVRequest().getMVRequestControlActive() : null;
         } else {
            return null;
         }
      }

      public boolean visible(Object var1) {
         return ((MVRequestControl)var1).getMVResponseControl().getViewVisible();
      }

      public boolean write(Object var1, boolean var2) {
         MVRequestControl var3 = (MVRequestControl)var1;
         AbstractMap var4 = var3.getMap();
         return var4 != null && var4.isInitialized() ? var3.mibsiSetRenderVisible(var2) : false;
      }

      public boolean execute(Runnable var1) {
         Navigation var2 = Navigation.getInstance();
         if (var2 == null) {
            return false;
         }

         DispatcherBase var3 = var2.getDispatcher();
         if (var3 == null) {
            return false;
         }

         var3.execute(var1);
         return true;
      }
   }
}
```

</details>

### Source 15: Bootstrap

Original path: `Bootstrap/final/install_bootstrap.sh`

<details id="source-15">
<summary>Read complete source</summary>

<!-- source-file: Bootstrap/final/install_bootstrap.sh; terminal-newline: yes -->

```sh
#!/bin/sh

SUPPORTED_FAMILY_MHI2="MHI2_"
SUPPORTED_FAMILY_MHI2Q="MHI2Q_"
VERSION_FILE="/net/rcc/dev/shmem/version.txt"
VOLUME="$1"
SCRIPT_DIR="/mnt/app/eso/hmi/engdefs/scripts/mibsi/v1"
MENU_FILE="/mnt/app/eso/hmi/engdefs/mibsi-main.esd"
MENU_STAGE="/mnt/app/eso/hmi/engdefs/mibsi-main.esd.new"
NODE_NAME=""
if test -x /bin/uname; then
    NODE_NAME=$(/bin/uname -n 2>/dev/null)
fi
case "$NODE_NAME" in
mmx|mmx.*)
    RUNNING_ON_RCC=0
    MMX_PREFIX=""
    ;;
*)
    RUNNING_ON_RCC=1
    MMX_PREFIX="/net/mmx"
    ;;
esac

run_mmx()
{
    if test "$RUNNING_ON_RCC" -eq 1; then
        on -f mmx "$@"
    else
        "$@"
    fi
}

is_supported_family()
{
    grep "$SUPPORTED_FAMILY_MHI2" "$VERSION_FILE" >/dev/null 2>&1 ||
        grep "$SUPPORTED_FAMILY_MHI2Q" "$VERSION_FILE" >/dev/null 2>&1
}

if test -z "$VOLUME"; then
    echo "MIBSI bootstrap: volume absent"
    exit 30
fi

if test ! -f "$VERSION_FILE"; then
    echo "MIBSI bootstrap: identite firmware indisponible"
    exit 31
fi

if ! is_supported_family; then
    echo "MIBSI bootstrap: famille MHI2/MHI2Q absente"
    exit 32
fi

if test ! -f "$MMX_PREFIX$MENU_STAGE"; then
    echo "MIBSI bootstrap: menu SWDL en staging absent"
    exit 33
fi

echo "MIBSI bootstrap: montage application en ecriture"
run_mmx /bin/mount -uw /mnt/app || exit 34

run_mmx /bin/mkdir -p "$SCRIPT_DIR" || {
    run_mmx /bin/mount -ur /mnt/app
    exit 35
}

run_mmx /bin/cp "$VOLUME/Bootstrap/scripts/status.sh" "$SCRIPT_DIR/status.sh" || {
    run_mmx /bin/mount -ur /mnt/app
    exit 36
}
run_mmx /bin/cp "$VOLUME/Bootstrap/scripts/activate.sh" "$SCRIPT_DIR/activate.sh" || {
    run_mmx /bin/mount -ur /mnt/app
    exit 37
}
run_mmx /bin/cp "$VOLUME/Bootstrap/scripts/disable_menu.sh" "$SCRIPT_DIR/disable_menu.sh" || {
    run_mmx /bin/mount -ur /mnt/app
    exit 38
}
run_mmx /bin/chmod 755 "$SCRIPT_DIR/status.sh" "$SCRIPT_DIR/activate.sh" "$SCRIPT_DIR/disable_menu.sh" || {
    run_mmx /bin/mount -ur /mnt/app
    exit 39
}

# SWDL a copie le menu sous l'extension inerte `.new`. Il est publie en
# dernier. Un echec anterieur ne rend donc jamais visible une entree GEM dont
# les scripts seraient absents ou partiels.
run_mmx /bin/chmod 644 "$MENU_STAGE" || {
    run_mmx /bin/mount -ur /mnt/app
    exit 41
}
run_mmx /bin/mv "$MENU_STAGE" "$MENU_FILE" || {
    run_mmx /bin/mount -ur /mnt/app
    exit 42
}

run_mmx /bin/sync
run_mmx /bin/mount -ur /mnt/app || exit 43
echo "MIBSI bootstrap: menu installe, rouvrir le GEM"
exit 0
```

</details>

### Source 16: product installer

Original path: `Bootstrap/final/product/install_product.sh`

<details id="source-16">
<summary>Read complete source</summary>

<!-- source-file: Bootstrap/final/product/install_product.sh; terminal-newline: yes -->

```sh
#!/bin/sh
# P5092 binary profile. Save replaced files, including third-party modifications.
SUPPORTED_TRAIN="MHI2Q_ER_AUG22_P5092"
SUPPORTED_TRAIN_ALIAS="MIB2Q_ER_AUG22_P5092"
SUPPORTED_TRAIN_P5152="MHI2Q_ER_AUG22_P5152"
SUPPORTED_MU="1329"
VERSION_FILE="/net/rcc/dev/shmem/version.txt"
VOLUME="$1"
PRODUCT_DIR="$VOLUME/Bootstrap/final/product"
TOOL="$PRODUCT_DIR/files/mibsi-install-tool"
LSD_SHA="8cd5994945fca9d983b268baa05c6ecad597fd2f99feaa2e83e831533e16fb48"
RECEIVER_SHA="6ef4abea8264ab7787b0ecb3fe278a65488301f703148d0175010f7b228bdaf6"
AIRPLAY_SHA="01c116b1674215daa0602d556a6d9b2eb48c2113ca294ea1f5d58787e3f656f2"
APP_RW=0
SYSTEM_RW=0
NODE_NAME=""
if test -x /bin/uname; then NODE_NAME=$(/bin/uname -n 2>/dev/null); fi
case "$NODE_NAME" in
    mmx|mmx.*) RUNNING_ON_RCC=0 ;;
    *) RUNNING_ON_RCC=1 ;;
esac

run_mmx()
{
    if test "$RUNNING_ON_RCC" -eq 1; then on -f mmx "$@"; else "$@"; fi
}

cleanup()
{
    CLEANUP_RESULT=0
    if test "$SYSTEM_RW" = 1; then
        if run_mmx /bin/mount -ur /mnt/system; then SYSTEM_RW=0; else CLEANUP_RESULT=1; fi
    fi
    if test "$APP_RW" = 1; then
        if run_mmx /bin/mount -ur /mnt/app; then APP_RW=0; else CLEANUP_RESULT=1; fi
    fi
    return "$CLEANUP_RESULT"
}

fail()
{
    echo "MIBSI: operation refusee: $*"
    exit 60
}
trap cleanup 0
trap 'exit 70' 1 2 15

if test -z "$VOLUME" || test ! -f "$PRODUCT_DIR/release.env" || test ! -x "$TOOL"; then
    fail "payload SD incomplet"
fi
. "$PRODUCT_DIR/release.env"
UNINSTALL_MARKER=0
FORCE_MARKER=0
if test -f "$VOLUME/MIBSI-UNINSTALL"; then UNINSTALL_MARKER=1; fi
if test -f "$VOLUME/MIBSI-FORCE"; then FORCE_MARKER=1; fi
case "$MIBSI_OPERATION:$UNINSTALL_MARKER:$FORCE_MARKER" in
    install:0:0|force-install:0:1) OPERATION=install ;;
    uninstall:1:0|force-uninstall:1:1) OPERATION=uninstall ;;
    *) fail "marqueurs SD incoherents" ;;
esac

if test ! -f "$VERSION_FILE" ||
   { ! grep "Current train = '$SUPPORTED_TRAIN'" "$VERSION_FILE" >/dev/null 2>&1 &&
     ! grep "Current train = '$SUPPORTED_TRAIN_ALIAS'" "$VERSION_FILE" >/dev/null 2>&1 &&
     ! grep "Current train = '$SUPPORTED_TRAIN_P5152'" "$VERSION_FILE" >/dev/null 2>&1; } ||
   ! grep "MainUnit version = '$SUPPORTED_MU'" "$VERSION_FILE" >/dev/null 2>&1; then
    fail "firmware hors liste Europe P5092/P5152 MU1329"
fi
# These dependencies are NOT replaced: hooks still require their exact ABI.
run_mmx "$TOOL" verify "$LSD_SHA" /ifs/lsd.jxe || fail "lsd.jxe incompatible"
run_mmx "$TOOL" verify "$RECEIVER_SHA" /eso/lib/libautoreceiver.so ||
    fail "libautoreceiver incompatible"
run_mmx "$TOOL" verify "$AIRPLAY_SHA" /eso/lib/libairplay.so ||
    fail "libairplay incompatible"
run_mmx "$TOOL" check-payload "$PRODUCT_DIR" || fail "payload SD altere"

# Optional garage package: refuse unknown/unreadable VIN before any writable
# product mount or transaction, including force-install. Recovery stays free.
if test "$OPERATION" = install && test "${MIBSI_VIN_NATIVE:-0}" = 1; then
    run_mmx "$TOOL" check-vin ||
        fail "VIN non autorise ou lecture VIN impossible"
fi

# No predecessor allowlist: native lifecycle captures bytes, mode, owner,
# symlink target and absence for EVERY managed path before publication.
run_mmx /bin/mount -uw /mnt/app || fail "montage app impossible"
APP_RW=1
run_mmx /bin/mount -uw /mnt/system || fail "montage system impossible"
SYSTEM_RW=1
run_mmx "$TOOL" lifecycle "$OPERATION" "$PRODUCT_DIR" "$MIBSI_RELEASE_ID"
RESULT=$?
run_mmx /bin/sync
if ! cleanup; then fail "remontage en lecture seule impossible"; fi
if test "$RESULT" -ne 0; then
    fail "operation non terminee ($RESULT); conserver la carte SD et relancer"
fi
echo "MIBSI: $OPERATION termine et relu; redemarrage MMI normal requis"
exit 0
```

</details>

### Source 17: native lifecycle evidence

Original path: `reverse-engineered/inventory/mibsi-install-tool.strings.txt`

<details id="source-17">
<summary>Read complete source</summary>

<!-- source-file: reverse-engineered/inventory/mibsi-install-tool.strings.txt; terminal-newline: yes -->

```text
000000d4	/usr/lib/ldqnx.so.2
000008dd	libc.so.3
000008e7	strcpy
000008ee	utime
000008f4	_init_array
00000900	sigemptyset
0000090c	snprintf
00000915	_Stdout
0000091d	errno
00000923	getpid
0000092a	_preinit_array
00000939	fgets
0000093f	memcpy
00000946	readlink
00000954	malloc
0000095b	lchown
00000962	fflush
00000969	chmod
0000096f	rename
00000976	strrchr
0000097e	fprintf
00000986	fseek
0000098c	memchr
00000993	__get_errno_ptr
000009a3	lstat
000009a9	ferror
000009b0	strstr
000009b7	unlink
000009be	memcmp
000009c5	sscanf
000009cc	sigaction
000009d6	fread
000009dc	symlink
000009e4	_init_libc
000009ef	fopen
000009f5	memset
00000a01	ftell
00000a07	fclose
00000a0e	_fini_array
00000a1a	strcmp
00000a21	fgetc
00000a27	atexit
00000a2e	_Stderr
00000a36	fsync
00000a3c	fwrite
00000a43	access
00000a4f	fileno
00000a56	strlen
00000a5d	strchr
00000a64	fcntl
00000a6a	mkdir
00000a75	pthread_mutex_lock
00000a88	pthread_mutex_unlock
00000a9d	pthread_once
00000aaa	waitpid
00000ab2	pthread_atfork
00000ac1	pthread_mutex_init
00000ad9	fdopen
00000ae0	fwide
00000ae6	confstr
00000aee	spawn
00000af4	pathfind_r
00000aff	_btext
00000b06	__exidx_start
00000b14	__exidx_end
00000b20	__data_start
00000b2d	_edata
00000b34	__bss_start
00000b40	__bss_start__
00000b4e	__bss_end__
00000b5a	__end__
00000b62	_stack
00000b69	__deregister_frame_info
00000b81	__register_frame_info
00004a54	MIBSI_JAR_BOOTSTRAP_V1
00004a6c	8a188ae556890051b623b18ab82f8a32f3dfdade4fd69240bf2b17b3f9ea5d4d
00004bb0	"MessagesSentByAccessory":["0x5000", "0x5002", "0xAE00", "0xAE02", "0xAE03", "0x4154", "0x4156", "0x4157", "0x4159", "0xFFFB", "0x4C00", "0x4C02", "0x4C03", "0x4C05", "0x5200", "0x5203"]
00004c6c	"MessagesReceivedFromDevice":["0x4E09", "0x4E0A", "0x4E0C", "0x5001", "0xAE01", "0x4155", "0x4158", "0xFFFA", "0xFFFC", "0x4C01", "0x4C04"]
00004cf8	MIBSI: %s: %s (errno=%d)
00004d14	mkdir
00004d34	002_mhi2q_aa_navigation_proxy.jar
00004d58	Find and append jar files
00004d74	lsd/jars
00004d80	for jar in $JARS
00004d94	BOOTCLASSPATH="$BOOTCLASSPATH:$jar"
00004dbc	BOOTCLASSPATH
00004dcc	BASE_DIR=
00004dd8	MIBSI: VIN check failed stage=%s code=%d reader_status=%d bytes=%lu errno=%d
00004e28	child_setup
00004e34	IPL_CONFIG_DIR=/etc/eso/production /eso/bin/apps/pc s:1501:30 2>/dev/null
00004e80	reader_start
00004e90	child_restore
00004ea0	output_limit
00004eb0	reader_read
00004ebc	reader_exit
00004ec8	binary_output
00004ed8	ambiguous
00004ee4	no_candidate
00004ef4	mismatch
00004f00	%s/%s
00004f08	path too long
00004f18	manifest
00004f24	manifest.sha256
00004f34	backup checksum missing
00004f4c	backup manifest corrupt
00004f64	MIBSI_BACKUP_V2 %u
00004f78	%u %c %o %lu %lu %64s %lld %lld %c
00004fa0	backup corrupt
00004fb0	install.sha256
00004fc0	%64s %127s %c
00004fd0	SD payload corrupt
00004fe4	write
00004ff4	refusing non-file destination
00005014	backup readback
00005024	MIBSI_BACKUP_V2 %u
00005038	%u %c %o %lu %lu %s %lld %lld
00005058	%s.mibsi-stage
00005068	non-file destination
00005080	staging readback
00005094	publish
0000509c	final readback
000050ac	history
000050b4	before
000050bc	check-vin
000050c8	lifecycle
000050d4	install
000050dc	uninstall
000050e8	/mnt/app/root/mibsi
000050fc	MIBSI: VIN non autorise ou lecture VIN impossible
00005130	installer.lock
00005140	pending
00005148	invalid pending journal
00005160	MIBSI: recovering interrupted operation before new work
00005198	recovery incomplete; keep SD and retry
000051c0	invalid original backup pointer
000051e0	MIBSI: no V2 installation to uninstall; existing files kept
0000521c	%lu-%lu-%u
00005228	%s.new
00005230	after
0000523c	release_id=%s
0000524c	format=MIBSI_INSTALLED_V2
00005266	state=installed
00005276	release_id=%s
00005284	firmware=MHI2Q_ER_AUG22_P5092_MU1329
000052ac	MIBSI: operation failed; restoring previous files
000052e0	rollback incomplete; pending journal retained
00005310	MIBSI: %s verified; backup history=%s
00005338	check-payload
00005348	verify
00005350	patch-dio
0000535c	lsd-state
00005368	patch-lsd
00005374	lsd-mode
00005380	MIBSI_JAR_BOOTSTRAP_V1
00005398	identify-release
000053ac	%64s %64s %64s %64s %64s %64s %64s %64s %1s
000053d8	known-component
000053e8	usage: mibsi-install-tool {sha256 FILE|verify SHA256 FILE|patch-dio SOURCE DEST|lsd-state FILE|lsd-mode FILE|patch-lsd SOURCE DEST|identify-release MANIFEST GAL DIO NAV AA CARPLAY TURN DISPLAY|known-component MANIFEST COLUMN FILE}
000054d0	/mnt/system/etc/eso/production/dio_manager.json
00005500	dio_manager.json
00005514	/mnt/app/eso/hmi/lsd/lsd.sh
00005530	lsd.sh
00005538	/eso/lib/libmhi2qaacluster.so
00005558	libmhi2qaacluster.so
00005570	/eso/lib/libmhi2qcarplaycluster.so
00005594	libmhi2qcarplaycluster.so
000055b0	/eso/bin/apps/mhi2q-aa-turn-card-renderer
000055dc	mhi2q-aa-turn-card-renderer
000055f8	/eso/bin/apps/mhi2q-aa-cluster-display
00005620	mhi2q-aa-cluster-display
0000563c	/mnt/app/eso/hmi/lsd/jars/001_mhi2q_aa_observer.jar
00005670	mhi2q-aa-hmi-safe-boot.jar
0000568c	/mnt/app/eso/hmi/lsd/jars/002_mhi2q_aa_navigation_proxy.jar
000056c8	mhi2q-aa-navigation-proxy.jar
000056e8	/eso/bin/apps/gal
000056fc	gal.mhi2q_aa_cluster_loader
00005718	/eso/bin/apps/dio_manager
00005734	dio_manager.mhi2q_carplay_loader
00005758	/mnt/app/eso/hmi/engdefs/mibsi-main.esd
00005780	mibsi-main.esd
00005790	/mnt/app/eso/hmi/engdefs/scripts/mibsi/v1/status.sh
000057c4	status.sh
000057d0	/mnt/app/eso/hmi/engdefs/scripts/mibsi/v1/activate.sh
00005808	activate.sh
00005814	/mnt/app/eso/hmi/engdefs/scripts/mibsi/v1/disable_menu.sh
00005850	disable_menu.sh
00005860	/mnt/app/root/mibsi/origin
0000587c	/mnt/app/root/mibsi/installed.release
000058a4	/mnt/app/root/mibsi/version
000058c0	0123456789abcdef
000058d4	# MIBSI_JAR_BOOTSTRAP_V1
000058ed	BOOTCLASSPATH="$BOOTCLASSPATH -Xbootclasspath/p:$BASE_DIR/lsd/jars/002_mhi2q_aa_navigation_proxy.jar"
00005a20	0123456789abcdef
00005a34	"MessagesSentByAccessory":["0x5000", "0x5002", "0xAE00", "0xAE02", "0xAE03", "0x4154", "0x4156", "0x4157", "0x4159", "0xFFFB", "0x4C00", "0x4C02", "0x4C03", "0x4C05"]
00005afb	["MessagesReceivedFromDevice":["0x4E09", "0x4E0A", "0x4E0C", "0x5001", "0xAE01", "0x4155", "0x4158", "0xFFFA", "0xFFFC", "0x4C01", "0x4C04", "0x5201", "0x5202", "0x5204"]
00005bac	/bin/sh
00005dc0	MIBSI_VIN_NATIVE_V1
00005df8	VIN_END
00005e15	GCC: (GNU) 4.9.4
00005e27	GCC: (GNU) 4.9.4
00005e39	GCC: (GNU) 4.4.2
00005e4b	GCC: (GNU) 4.9.4
00005e61	aeabi
00005e8a	.shstrtab
00005e94	.interp
00005e9c	.hash
00005ea2	.dynsym
00005eaa	.dynstr
00005eb2	.rel.dyn
00005ebb	.rel.plt
00005ec4	.init
00005eca	.text
00005ed0	.fini
00005ed6	.rodata
00005ede	.eh_frame
00005ee8	.init_array
00005ef4	.fini_array
00005f05	.dynamic
00005f13	.data
00005f1e	.comment
00005f27	.ARM.attributes
```

</details>

### Source 18: Preserved Java attribution

Original path: `reverse-engineered/java-resources/mhi2q-aa-navigation-proxy/META-INF/NOTICE.txt`

<details id="source-18">
<summary>Read complete source</summary>

<!-- source-file: reverse-engineered/java-resources/mhi2q-aa-navigation-proxy/META-INF/NOTICE.txt; terminal-newline: yes -->

```text
Java source attribution

com.nicolas.carplay.framework.Log (formerly the inherited logger):
Copyright (c) 2026 LuKa (@LuKa_dev)

The package namespace has been renamed; this notice preserves the original
source attribution and does not transfer authorship.
```

</details>
