import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
    // Add the Google services Gradle plugin
    id("com.google.gms.google-services")
}

// ── Keystore / signing ─────────────────────────────────────────────────────
// key.properties lives in android/ (sibling of this app/ folder).
// It is .gitignored and written by CI from encrypted secrets.
// If the file is absent (e.g. on a developer machine without the keystore),
// the release build falls back to the debug signing config so that
// `flutter run --release` still works locally.
val keystorePropertiesFile = rootProject.file("key.properties")
val keystoreProperties = Properties().apply {
    if (keystorePropertiesFile.exists()) {
        load(FileInputStream(keystorePropertiesFile))
    }
}

android {
    namespace = "com.fortyseven.thesven"
    compileSdk = 36
    ndkVersion = "28.2.13676358"

    compileOptions {
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.fortyseven.thesven"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = 24
        targetSdk = 36
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        testInstrumentationRunner = "pl.leancode.patrol.PatrolJUnitRunner"
        testInstrumentationRunnerArguments["clearPackageData"] = "true"
    }

    testOptions {
        execution = "ANDROIDX_TEST_ORCHESTRATOR"
    }

    signingConfigs {
        create("release") {
            if (keystorePropertiesFile.exists()) {
                keyAlias      = keystoreProperties.getProperty("keyAlias")
                keyPassword   = keystoreProperties.getProperty("keyPassword")
                storeFile     = file(keystoreProperties.getProperty("storeFile")!!)
                storePassword = keystoreProperties.getProperty("storePassword")
            }
        }
    }

    buildTypes {
        release {
            // Use the release signing config when key.properties is present (CI / local
            // developer with keystore). Fall back to debug keys otherwise so that
            // `flutter run --release` works without any keystore setup.
            signingConfig = if (keystorePropertiesFile.exists())
                signingConfigs.getByName("release")
            else
                signingConfigs.getByName("debug")
        }
    }

    // ── Flavor dimensions ─────────────────────────────────────────────────
    // Three flavors: dev, staging, prod.
    // Each flavor installs as a separate app on the device (distinct
    // applicationId) so dev/staging/prod can coexist side-by-side.
    //
    // Flutter build commands:
    //   flutter build apk --flavor dev --target lib/main_dev.dart ...
    //   flutter build apk --flavor staging --target lib/main_staging.dart ...
    //   flutter build apk --flavor prod --target lib/main.dart ...
    flavorDimensions += "environment"

    productFlavors {
        create("dev") {
            dimension = "environment"
            applicationIdSuffix = ".dev"
            versionNameSuffix = "-dev"
            // Sets android:label via @string/app_name (per-flavor resource).
            resValue("string", "app_name", "Sven Dev")
        }
        create("staging") {
            dimension = "environment"
            applicationIdSuffix = ".staging"
            versionNameSuffix = "-staging"
            resValue("string", "app_name", "Sven Staging")
        }
        create("prod") {
            dimension = "environment"
            // No suffix — this is the production release build.
            resValue("string", "app_name", "Sven")
        }
    }
}

flutter {
    source = "../.."
}

dependencies {
    // Core library desugaring (required by flutter_local_notifications)
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")

    // Import the Firebase BoM
    implementation(platform("com.google.firebase:firebase-bom:34.9.0"))

    // Firebase Cloud Messaging for push notifications
    implementation("com.google.firebase:firebase-messaging")
    
    // Firebase Analytics
    implementation("com.google.firebase:firebase-analytics")

    // Patrol Android instrumentation orchestrator
    androidTestUtil("androidx.test:orchestrator:1.5.1")
}
