# ─── Sven Production ProGuard Rules ────────────────────────────────
# Applied during release builds for code shrinking / obfuscation.

# ── Flutter framework ─────────────────────────────────────────────
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }
-dontwarn io.flutter.embedding.**

# ── Firebase Cloud Messaging & Analytics ──────────────────────────
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ── Sentry crash reporting ────────────────────────────────────────
-keep class io.sentry.** { *; }
-dontwarn io.sentry.**

# ── PointyCastle / Encrypt (E2EE crypto) ─────────────────────────
-keep class org.bouncycastle.** { *; }
-dontwarn org.bouncycastle.**

# ── HTTP / networking ─────────────────────────────────────────────
-keep class okhttp3.** { *; }
-dontwarn okhttp3.**
-keep class okio.** { *; }
-dontwarn okio.**

# ── Flutter Secure Storage ────────────────────────────────────────
-keep class com.it_nomads.fluttersecurestorage.** { *; }

# ── Local Auth (biometric) ────────────────────────────────────────
-keep class androidx.biometric.** { *; }

# ── Speech-to-text ────────────────────────────────────────────────
-keep class com.csdcorp.speech_to_text.** { *; }

# ── Share Plus ────────────────────────────────────────────────────
-keep class dev.fluttercommunity.plus.share.** { *; }

# ── URL Launcher ──────────────────────────────────────────────────
-keep class io.flutter.plugins.urllauncher.** { *; }

# ── Connectivity Plus ─────────────────────────────────────────────
-keep class dev.fluttercommunity.plus.connectivity.** { *; }

# ── JSON serialization (keep model classes from being stripped) ───
-keepattributes *Annotation*
-keep class * implements java.io.Serializable { *; }

# ── AndroidX Activity / Fragment (permission request callbacks) ──
-keep class androidx.activity.** { *; }
-keep class androidx.fragment.** { *; }
-keep class androidx.core.app.ActivityCompat** { *; }
-keep class androidx.core.content.ContextCompat** { *; }
-dontwarn androidx.activity.**
-dontwarn androidx.fragment.**

# ── Proximity Sensor ─────────────────────────────────────────────
-keep class dev.jeremyko.proximity_sensor.** { *; }

# ── Suppress missing class warnings from third-party libs ────────
-dontwarn java.lang.invoke.StringConcatFactory
