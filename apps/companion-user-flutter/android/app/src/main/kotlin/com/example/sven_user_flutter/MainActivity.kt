package com.fortyseven.thesven

import android.content.Intent
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterFragmentActivity() {
    companion object {
        private const val METHOD_CHANNEL = "com.fortyseven.thesven/wake_word_control"
        private const val EVENT_CHANNEL = "com.fortyseven.thesven/wake_word_events"
        private val mainHandler = Handler(Looper.getMainLooper())
        private var eventSink: EventChannel.EventSink? = null
        private val pendingWakeEvents = ArrayDeque<Map<String, String>>()

        fun emitWakeEventFromService(event: Map<String, String>) {
            mainHandler.post {
                val sink = eventSink
                if (sink != null) {
                    sink.success(event)
                } else {
                    pendingWakeEvents.addLast(event)
                }
            }
        }
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, METHOD_CHANNEL)
            .setMethodCallHandler { call: MethodCall, result: MethodChannel.Result ->
                when (call.method) {
                    "startWakeWordService" -> {
                        val phrase = call.argument<String>("wakePhrase")?.trim().orEmpty()
                        if (phrase.isBlank()) {
                            result.error("validation", "wakePhrase is required", null)
                            return@setMethodCallHandler
                        }
                        val intent = WakeWordForegroundService.startIntent(this, phrase)
                        ContextCompat.startForegroundService(this, intent)
                        result.success(true)
                    }

                    "stopWakeWordService" -> {
                        startService(WakeWordForegroundService.stopIntent(this))
                        result.success(true)
                    }

                    else -> result.notImplemented()
                }
            }

        EventChannel(flutterEngine.dartExecutor.binaryMessenger, EVENT_CHANNEL)
            .setStreamHandler(object : EventChannel.StreamHandler {
                override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
                    eventSink = events
                    while (pendingWakeEvents.isNotEmpty()) {
                        events?.success(pendingWakeEvents.removeFirst())
                    }
                }

                override fun onCancel(arguments: Any?) {
                    eventSink = null
                }
            })

        handleWakeIntent(intent)
    }

    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        super.onCreate(savedInstanceState)
        handleWakeIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleWakeIntent(intent)
    }

    override fun onPostResume() {
        super.onPostResume()
        try {
            reportFullyDrawn()
        } catch (_: Throwable) {
            // Best effort only; startup should never fail on this signal.
        }
    }

    private fun handleWakeIntent(intent: Intent?) {
        if (intent?.action != WakeWordForegroundService.ACTION_WAKE_TRIGGERED) return
        emitWakeEventFromService(
            mapOf(
                "phrase" to intent.getStringExtra(WakeWordForegroundService.EXTRA_WAKE_PHRASE).orEmpty(),
                "transcript" to intent.getStringExtra(WakeWordForegroundService.EXTRA_TRANSCRIPT).orEmpty(),
                "remainder" to intent.getStringExtra(WakeWordForegroundService.EXTRA_REMAINDER).orEmpty(),
                "type" to "wake_detected",
                "source" to "android_foreground_service",
            ),
        )
        intent.action = null
    }
}
