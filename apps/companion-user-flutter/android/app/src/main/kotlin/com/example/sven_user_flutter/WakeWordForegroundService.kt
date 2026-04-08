package com.fortyseven.thesven

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.os.IBinder
import android.util.Base64
import android.util.Log
import androidx.core.app.NotificationCompat
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.max

class WakeWordForegroundService : Service() {
    private val logTag = "WakeWordForeground"

    companion object {
        const val ACTION_START = "com.fortyseven.thesven.action.START_WAKE_WORD"
        const val ACTION_STOP = "com.fortyseven.thesven.action.STOP_WAKE_WORD"
        const val ACTION_WAKE_TRIGGERED = "com.fortyseven.thesven.action.WAKE_TRIGGERED"
        const val EXTRA_WAKE_PHRASE = "wake_phrase"
        const val EXTRA_TRANSCRIPT = "transcript"
        const val EXTRA_REMAINDER = "remainder"

        private const val NOTIFICATION_CHANNEL_ID = "sven_voice_wake_service"
        private const val NOTIFICATION_CHANNEL_NAME = "Voice wake"
        private const val NOTIFICATION_ID = 47047
        private const val SAMPLE_RATE_HZ = 16000
        private const val CAPTURE_WINDOW_MS = 1500
        private const val CAPTURE_PAUSE_MS = 400L

        fun startIntent(context: Context, wakePhrase: String): Intent =
            Intent(context, WakeWordForegroundService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_WAKE_PHRASE, wakePhrase)
            }

        fun stopIntent(context: Context): Intent =
            Intent(context, WakeWordForegroundService::class.java).apply {
                action = ACTION_STOP
            }
    }

    @Volatile
    private var wakePhrase = "hey sven"

    @Volatile
    private var captureActive = false

    private var captureThread: Thread? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopCaptureLoop()
                stopSelf()
                return START_NOT_STICKY
            }

            ACTION_START, null -> {
                val incomingPhrase = intent?.getStringExtra(EXTRA_WAKE_PHRASE)?.trim().orEmpty()
                if (incomingPhrase.isNotBlank()) {
                    wakePhrase = incomingPhrase
                    updateNotification()
                }
                startCaptureLoop()
            }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        stopCaptureLoop()
        super.onDestroy()
    }

    private fun startCaptureLoop() {
        if (captureActive) return
        captureActive = true
        captureThread = Thread {
            runCaptureLoop()
        }.apply {
            name = "SvenWakeWordCapture"
            isDaemon = true
            start()
        }
    }

    private fun stopCaptureLoop() {
        captureActive = false
        captureThread?.interrupt()
        captureThread = null
    }

    private fun runCaptureLoop() {
        val minBufferSize = AudioRecord.getMinBufferSize(
            SAMPLE_RATE_HZ,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
        )
        if (minBufferSize <= 0) {
            Log.e(logTag, "AudioRecord minBufferSize unavailable: $minBufferSize")
            stopSelf()
            return
        }

        val bytesPerSample = 2
        val targetBytes = SAMPLE_RATE_HZ * CAPTURE_WINDOW_MS / 1000 * bytesPerSample
        val bufferSize = max(minBufferSize, targetBytes)

        val audioRecord = try {
            AudioRecord(
                MediaRecorder.AudioSource.VOICE_RECOGNITION,
                SAMPLE_RATE_HZ,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                bufferSize,
            )
        } catch (error: Throwable) {
            Log.e(logTag, "AudioRecord init failed", error)
            stopSelf()
            return
        }

        if (audioRecord.state != AudioRecord.STATE_INITIALIZED) {
            Log.e(logTag, "AudioRecord not initialized")
            audioRecord.release()
            stopSelf()
            return
        }

        try {
            audioRecord.startRecording()
            Log.i(logTag, "capture loop started phrase=$wakePhrase")

            while (captureActive && !Thread.currentThread().isInterrupted) {
                val pcm = ByteArray(targetBytes)
                var totalRead = 0
                while (captureActive && totalRead < targetBytes && !Thread.currentThread().isInterrupted) {
                    val read = audioRecord.read(pcm, totalRead, targetBytes - totalRead)
                    if (read <= 0) {
                        Log.w(logTag, "AudioRecord read failed: $read")
                        break
                    }
                    totalRead += read
                }

                if (totalRead > 0) {
                    val wavBytes = wrapPcmAsWav(pcm.copyOf(totalRead))
                    val payload = Base64.encodeToString(wavBytes, Base64.NO_WRAP)
                    MainActivity.emitWakeEventFromService(
                        mapOf(
                            "type" to "audio_window",
                            "phrase" to wakePhrase,
                            "audio_base64" to payload,
                            "audio_mime" to "audio/wav",
                            "source" to "android_foreground_service",
                        ),
                    )
                    Log.i(logTag, "audio window emitted bytes=${wavBytes.size}")
                }

                Thread.sleep(CAPTURE_PAUSE_MS)
            }
        } catch (error: InterruptedException) {
            Thread.currentThread().interrupt()
        } catch (error: Throwable) {
            Log.e(logTag, "capture loop failed", error)
        } finally {
            try {
                audioRecord.stop()
            } catch (_: Throwable) {
            }
            audioRecord.release()
            Log.i(logTag, "capture loop stopped")
        }
    }

    private fun wrapPcmAsWav(pcmBytes: ByteArray): ByteArray {
        val totalAudioLen = pcmBytes.size
        val totalDataLen = totalAudioLen + 36
        val byteRate = SAMPLE_RATE_HZ * 2
        val output = ByteArrayOutputStream(totalAudioLen + 44)

        output.write("RIFF".toByteArray())
        output.write(intToLittleEndian(totalDataLen))
        output.write("WAVE".toByteArray())
        output.write("fmt ".toByteArray())
        output.write(intToLittleEndian(16))
        output.write(shortToLittleEndian(1))
        output.write(shortToLittleEndian(1))
        output.write(intToLittleEndian(SAMPLE_RATE_HZ))
        output.write(intToLittleEndian(byteRate))
        output.write(shortToLittleEndian(2))
        output.write(shortToLittleEndian(16))
        output.write("data".toByteArray())
        output.write(intToLittleEndian(totalAudioLen))
        output.write(pcmBytes)
        return output.toByteArray()
    }

    private fun intToLittleEndian(value: Int): ByteArray =
        ByteBuffer.allocate(4).order(ByteOrder.LITTLE_ENDIAN).putInt(value).array()

    private fun shortToLittleEndian(value: Int): ByteArray =
        ByteBuffer.allocate(2).order(ByteOrder.LITTLE_ENDIAN).putShort(value.toShort()).array()

    private fun buildNotification(): Notification {
        val contentIntent = PendingIntent.getActivity(
            this,
            0,
            packageManager.getLaunchIntentForPackage(packageName),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        return NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle("Sven voice wake active")
            .setContentText("Listening for \"$wakePhrase\"")
            .setContentIntent(contentIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build()
    }

    private fun updateNotification() {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, buildNotification())
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (manager.getNotificationChannel(NOTIFICATION_CHANNEL_ID) != null) return
        manager.createNotificationChannel(
            NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                NOTIFICATION_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW,
            ),
        )
    }
}
