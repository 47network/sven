package com.example.sven_user_flutter

import io.flutter.embedding.android.FlutterFragmentActivity

class MainActivity : FlutterFragmentActivity() {
    override fun onPostResume() {
        super.onPostResume()
        try {
            reportFullyDrawn()
        } catch (_: Throwable) {
            // Best effort only; startup should never fail on this signal.
        }
    }
}
