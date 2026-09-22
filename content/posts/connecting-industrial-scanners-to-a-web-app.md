---
title: "Connecting industrial scanners to a web application"
description: "Bridging vendor-specific barcode and RFID hardware into a shared WebView workflow on Android."
date: "2026-02-08"
tags: [Android, Kotlin, Hardware integration]
draft: false
---

A warehouse application can share its screens across devices, but the hardware underneath those screens has different ways to report a scan. One terminal delivers a broadcast intent. Another requires a vendor SDK. A Bluetooth RFID reader adds connection state, trigger modes, and batches of repeated tag reads.

The Android Scanner project provides a native shell around a web application. The shell connects device services to JavaScript callbacks and exposes scanner controls to the page. Kotlin handles most of the Android code, with a small Java bridge for calls from JavaScript.

The repository preserves a single source upload from 8 February 2026. I use that date here because Git does not retain the earlier development timeline. The discussion follows the implementation in that snapshot.

## Giving the web application one scanner contract

The native code defines a `ScanService` interface with operations to start, close, enable, disable, and query the scanner. A separate listener reports opening, closing, errors, and scanned data.

The application selects an adapter using the device manufacturer. The snapshot includes Honeywell and Urovo paths, with DataWedge as the default. Each adapter translates the native mechanism into the shared listener contract.

For DataWedge, setup includes requesting the list of profiles, creating the application's profile if needed, and checking again after a delay. Urovo uses `ScanManager` and a broadcast receiver for decoded barcode strings. The Honeywell adapter receives Honeywell actions while retaining some DataWedge-oriented setup code, an important limit of the abstraction in this version.

The shared interface keeps vendor selection outside the web workflow:

```text
Scanner hardware
    -> vendor service or broadcast
    -> ScanService adapter
    -> ScanListener
    -> Android activity
    -> JavaScript callback in the WebView
```

The interface standardizes the operations available to callers. It does not prove that every adapter has equivalent lifecycle behaviour. That still needs testing on the corresponding hardware.

## Crossing the native-to-web boundary

The activity forwards a decoded value to `handleScannerInput`. It also calls functions for device information, scanner status, and scanner errors. Android posts these calls onto the main thread before invoking `evaluateJavascript`.

Traffic travels in the other direction through an object registered as `Android`. The page can call its annotated Java methods to enable or disable the scanner. A workflow can therefore suspend scanning while the user edits another field and enable it when the next barcode is expected.

This boundary needs two forms of care. The activity must run WebView operations on the UI thread, and it must encode the payload as data. The archived implementation interpolates scan content into a JavaScript string. A barcode containing a quote can break that representation. A stronger bridge would serialize the value and restrict the origins allowed to invoke native methods.

The snapshot also proceeds after WebView certificate errors. That behaviour belongs to the archived implementation, not to a recommended deployment configuration. The native bridge increases the importance of deciding which pages the shell trusts.

## Preserving scanner state across activity transitions

The application owns the scanner service, while the activity attaches as the current listener. A proxy listener allows the activity to detach without making the vendor adapter depend on a particular screen instance.

On pause, the activity remembers whether scanning was enabled, disables the scanner, and detaches its listener. On resume, it reconnects the listener and restores scanning when appropriate. RFID event listeners follow the same activity transitions.

This arrangement addresses a common integration problem: the hardware can remain available longer than the screen that consumes its events. A settings screen, a background transition, or a recreated activity should not leave the scanner delivering results to an obsolete view.

The adapter implementations still need scrutiny. Some flags describe a requested state rather than confirmed hardware state, and receiver registration and cleanup differ between vendors. Keeping the contract small makes those differences easier to inspect, but does not remove them.

## Treating RFID as repeated observations

The RFID path connects to a saved Bluetooth device, creates a reader, and starts a background read loop. Tag observations include an EPC identifier. The code accumulates tag records and counts repeated observations under synchronization before forwarding identifiers to the web layer.

An RFID reader can observe the same object many times during one trigger hold. The snapshot deduplicates entries in its native list, but forwards the accumulated list again on updates. That means the web application can still receive repeated identifiers. A consuming workflow must decide whether it wants an observation stream, a set of unique items, or one accepted scan per operation.

That distinction belongs in the integration contract. Removing duplicates in a display list does not make downstream actions run once.

## Shipping configuration alongside the shell

The shell can download a configuration list, select the entry matching its application package, compare version strings, and download an APK. This separates the location of the web application from the native package update path.

Version inequality is the check present in the snapshot; it does not establish that an offered version is newer. A deployment process also needs to account for package integrity and installation policy.

The main engineering boundary remains useful: web screens handle the operational workflow, vendor adapters handle hardware access, and the activity coordinates delivery between them. Most of the difficult cases occur at those boundaries, especially during lifecycle changes and repeated reads.
