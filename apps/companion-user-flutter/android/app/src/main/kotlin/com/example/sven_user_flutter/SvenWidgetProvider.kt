package com.example.sven_user_flutter

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews
import android.app.PendingIntent
import android.content.Intent
import android.net.Uri

/**
 * SvenWidgetProvider
 *
 * Android [AppWidgetProvider] for the Sven home-screen widget.
 * Data is written by the Flutter side via the `home_widget` package into
 * a SharedPreferences file named after [prefsName].
 *
 * The widget tap launches the main activity with a deep-link URI so the
 * Flutter router can navigate to the relevant screen.
 */
class SvenWidgetProvider : AppWidgetProvider() {

    companion object {
        /** Must match the app_group_id used in HomeWidgetService (home_widget pkg). */
        private const val prefsName = "HomeWidgetPreferences"

        private const val keyLastMessage = "sven_last_message"
        private const val keyUsername    = "sven_username"
        private const val keyUpdatedAt   = "sven_updated_at"

        private const val launchUri = "sven://widget/tap"
    }

    // ── Called when the widget needs to be drawn or refreshed ─────────────────

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        appWidgetIds.forEach { widgetId ->
            updateWidget(context, appWidgetManager, widgetId)
        }
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    private fun updateWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        widgetId: Int,
    ) {
        val prefs = context.getSharedPreferences(prefsName, Context.MODE_PRIVATE)

        val message   = prefs.getString(keyLastMessage, "Open Sven to start chatting…")
        val username  = prefs.getString(keyUsername,    "")
        val updatedAt = prefs.getString(keyUpdatedAt,   "")

        val views = RemoteViews(context.packageName, R.layout.sven_widget).apply {
            setTextViewText(R.id.widget_message,    message    ?: "")
            setTextViewText(R.id.widget_username,   username   ?: "")
            setTextViewText(R.id.widget_updated_at, updatedAt  ?: "")

            // Tap the widget → launch the app with a deep-link URI.
            val intent = Intent(
                Intent.ACTION_VIEW,
                Uri.parse(launchUri),
                context,
                MainActivity::class.java,
            ).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pendingIntent = PendingIntent.getActivity(
                context,
                widgetId,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            setOnClickPendingIntent(R.id.widget_root, pendingIntent)
        }

        appWidgetManager.updateAppWidget(widgetId, views)
    }
}
