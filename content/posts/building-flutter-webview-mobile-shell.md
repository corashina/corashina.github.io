---
title: "Bridging native sign-in and a web session"
description: "Connecting a hosted business application to Android biometrics, native Google sign-in, browser session state, and mobile file handling through Flutter."
date: "2022-11-28"
tags: [Flutter, Mobile, WebView]
draft: false
---

I built a Flutter application that placed an existing business platform inside a mobile shell. The web application kept its screens and workflow. Flutter handled the parts that needed a device: biometric access, Google sign-in, mobile navigation, and downloaded files.

This approach produced a narrow client with an unusual boundary. Native code, Dart, a WebView, and the hosted JavaScript application all took part in one login. A token could be valid in Dart while the web application still considered the user signed out. A download could begin in the page while Flutter had to decide where the resulting bytes belonged.

*Retrospective: the date is an editorial placement, not a verified project completion date.*

Much of the integration depends on URL interception and JavaScript injection, and the main WebView screen grew to hold many responsibilities.

## The shell and its boundaries

The app starts with a Flutter router and a single main page. That page creates an `InAppWebView`, points it at the hosted application, and enables cookies, JavaScript, and multiple-window support. The Android back button first asks the WebView whether it has browser history. If it does, Flutter moves back inside the page instead of closing the app.

Three runtimes meet in that screen:

| Runtime | Responsibility |
| --- | --- |
| Android/Kotlin | Show the platform biometric prompt |
| Flutter/Dart | Own the WebView, native sign-in, token exchange, and file handling |
| Hosted JavaScript app | Render the business interface and manage its browser auth state |

The app calls a custom method channel named for biometric authentication during launch. `MainActivity` receives that call, checks whether Android can authenticate with a weak biometric, and opens `BiometricPrompt`. It sends success, failure, or an error back to Dart.

The home page does not wait to render a separate Flutter login screen. It starts the biometric check during initialization. A failed check requests that Android close the activity; an exception produces a message inside the Flutter view.

This version implements the custom biometric channel on Android. An iOS client would need its own handler or a shared plugin path. The project also contains a Dart action built on `local_auth`, but the home page calls the custom channel instead. I would consolidate those paths before extending biometric access across platforms.

## Moving Google sign-in across the WebView boundary

The hosted application can send the WebView toward several login URLs. Flutter inspects each navigation request and lets ordinary application pages continue. A match against the login indicators makes Dart cancel that navigation and start native Google sign-in.

The flow follows this sequence:

```text
Hosted login link
    -> Flutter intercepts WebView navigation
    -> native Google account selection
    -> Google ID token
    -> backend token exchange
    -> application access token
    -> reload hosted application
    -> inject browser session state
```

Before opening the account picker, the code signs out of the previous Google session. The sign-in request asks for identity scopes and calendar access. Dart then reads the ID token and sends it to the platform's token-exchange endpoint with the organization and a platform flag.

The organization value creates another bridge. The hosted login page owns that input, so Dart asks the WebView to inspect a set of input and select elements. It also checks URL query parameters. If those probes produce no value, the client uses a default organization.

The following pseudocode shows the shape of the exchange without copying environment details from the source:

```dart
// Illustrative pseudocode
final idToken = await nativeGoogleSignIn();
final organization = await readOrganizationFromWebView();

final response = await postJson(exchangeEndpoint, {
  'GoogleJwtToken': idToken,
  'organization': organization,
  'isGoogle': Platform.isAndroid,
});

pendingAccessToken = response.accessToken;
await webView.loadUrl(applicationUrl);
```

The client stores the returned token in memory until the application page finishes loading. That pending state prevents Dart from injecting credentials into the old login document.

## Teaching the hosted application about the native session

The backend exchange gives Flutter an application token. The hosted SPA still needs the browser state that its web login would have created.

After the target page loads, Dart evaluates JavaScript inside the WebView. The script writes token variants to local and session storage, creates the browser cookies used by the platform, decodes selected JWT claims, and stores the user identifier. It then tries several hooks for dispatching the authenticated user into the SPA's state store.

The handshake has two stages. The first stage establishes browser storage and cookies. The second constructs a user object from token claims and updates the web application's auth state. Flutter clears the pending token after both stages and sends the page to its root route.

This technique let the mobile shell reuse the hosted application, but it couples the client to browser details that do not form a stable API. Storage key changes can break login. A renamed Redux action can leave a valid token disconnected from the visible screen. DOM selectors for the organization field can drift as the login form changes.

I would replace those probes with one documented JavaScript bridge owned by the web application. The page could expose a versioned method such as `acceptMobileSession`, validate the payload, and return a structured result. Dart would no longer need to know the store's global names or the login form's markup.

## Handling downloads from a hosted page

The WebView reports downloads through `onDownloadStartRequest`. Flutter receives the URL and writes the file into the application's documents directory.

The handler supports two input shapes. For a `data:` URL, it finds the base64 section, decodes the bytes, and writes them to disk. For a regular URL, it opens an HTTP connection and pipes the response into a file. The app then asks the operating system to open the result.

The source also contains an Android permission path and a helper that can copy text files to the public Downloads directory. Those paths reflect the awkward transition between app-private storage and files a user expects to find outside the app. The active download handler uses application documents, which avoids a broad storage permission for its main path.

The filename parser searches for a `filename` parameter. A normal URL without that parameter falls back to a generic binary filename. A stronger implementation would inspect response headers, validate MIME types, close the HTTP client, and handle non-success status codes before writing a file.

## Tradeoffs in the runtime bridge

The mobile shell covers Android biometrics, native identity, a hosted SPA session, WebView navigation, and device files without duplicating the business interface in Flutter. The custom biometric channel in this version belongs to Android. An iOS client would need its own channel handler or a shared plugin path.

Most maintenance risk comes from the SPA coupling. The main screen coordinates browser navigation, identity, injected state, and downloads. For a follow-up implementation, I would split it into an authentication coordinator, a small WebView bridge, and a download service. I would also give the hosted application one supported session API and test each message that crosses the bridge.

In this version, Flutter coordinates four concrete handoffs: the Android prompt, native identity exchange, browser session setup, and file downloads initiated by the hosted page.
