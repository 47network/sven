import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_models.dart';
import 'sven_semantic_colors.dart';
import 'sven_tokens.dart';

ThemeData buildSvenTheme(
  VisualMode mode, {
  ColorScheme? dynamicScheme,
  Color? customAccent,
  bool highContrast = false,
  bool colorBlindMode = false,
}) {
  final rawTokens = SvenTokens.forMode(mode);
  // If a custom accent is chosen by the user, override the token primary.
  final accentedTokens = customAccent != null
      ? rawTokens.copyWithPrimary(customAccent)
      : rawTokens;
  // Apply colour-blind-safe palette when requested.
  final cbTokens =
      colorBlindMode ? accentedTokens.copyWithColorBlind() : accentedTokens;
  // Apply high-contrast amplification last so it wins over accent and CBM.
  final tokens = highContrast ? cbTokens.copyWithHighContrast() : cbTokens;
  final baseTextTheme = mode == VisualMode.cinematic
      ? const TextTheme(
          displaySmall: TextStyle(fontSize: 32, fontWeight: FontWeight.w600),
          headlineSmall: TextStyle(fontSize: 22, fontWeight: FontWeight.w600),
          titleMedium: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
          bodyLarge: TextStyle(fontSize: 16, height: 1.45),
          bodyMedium: TextStyle(fontSize: 14, height: 1.45),
          labelLarge: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            letterSpacing: 1.2,
          ),
        )
      : const TextTheme(
          displaySmall: TextStyle(fontSize: 30, fontWeight: FontWeight.w600),
          headlineSmall: TextStyle(fontSize: 22, fontWeight: FontWeight.w600),
          titleMedium: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
          bodyLarge: TextStyle(fontSize: 16, height: 1.5),
          bodyMedium: TextStyle(fontSize: 14, height: 1.5),
          labelLarge: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.8,
          ),
        );

  // Apply Inter font via google_fonts
  final textTheme = GoogleFonts.interTextTheme(baseTextTheme).copyWith(
    displaySmall: GoogleFonts.inter(
      textStyle: baseTextTheme.displaySmall,
      fontWeight: FontWeight.w600,
    ),
    headlineSmall: GoogleFonts.inter(
      textStyle: baseTextTheme.headlineSmall,
      fontWeight: FontWeight.w600,
    ),
    titleMedium: GoogleFonts.inter(
      textStyle: baseTextTheme.titleMedium,
      fontWeight: FontWeight.w600,
    ),
    bodyLarge: GoogleFonts.inter(textStyle: baseTextTheme.bodyLarge),
    bodyMedium: GoogleFonts.inter(textStyle: baseTextTheme.bodyMedium),
    bodySmall: GoogleFonts.inter(
      fontSize: 12,
      color: tokens.onSurface.withValues(alpha: 0.6),
    ),
    labelLarge: GoogleFonts.inter(
      textStyle: baseTextTheme.labelLarge,
      fontWeight: FontWeight.w600,
    ),
  );
  final semanticColors = mode == VisualMode.cinematic
      ? const SvenSemanticColors(
          info: Color(0xFF4FD1FF),
          success: Color(0xFF22E19A),
          warn: Color(0xFFF6C453),
          error: Color(0xFFFF6B6B),
          critical: Color(0xFFFF2D55),
        )
      : const SvenSemanticColors(
          info: Color(0xFF0EA5E9),
          success: Color(0xFF22C55E),
          warn: Color(0xFFF59E0B),
          error: Color(0xFFEF4444),
          critical: Color(0xFFB91C1C),
        );

  // ── Component themes ──

  final appBarTheme = AppBarTheme(
    elevation: 0,
    scrolledUnderElevation: 0,
    centerTitle: false,
    backgroundColor: Colors.transparent,
    surfaceTintColor: Colors.transparent,
    titleTextStyle: TextStyle(
      color: tokens.onSurface,
      fontSize: 18,
      fontWeight: FontWeight.w600,
      letterSpacing: -0.3,
    ),
    iconTheme: IconThemeData(color: tokens.onSurface, size: 22),
  );

  final inputDecoration = InputDecorationTheme(
    filled: true,
    fillColor: mode == VisualMode.cinematic
        ? Colors.white.withValues(alpha: 0.04)
        : Colors.white.withValues(alpha: 0.8),
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: BorderSide(
        color: mode == VisualMode.cinematic
            ? Colors.white.withValues(alpha: 0.08)
            : Colors.black.withValues(alpha: 0.08),
      ),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: BorderSide(
        color: mode == VisualMode.cinematic
            ? Colors.white.withValues(alpha: 0.08)
            : Colors.black.withValues(alpha: 0.08),
      ),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: BorderSide(
        color: tokens.primary.withValues(alpha: 0.5),
        width: 1.5,
      ),
    ),
    hintStyle: TextStyle(
      color: tokens.onSurface.withValues(alpha: 0.35),
      fontSize: 15,
    ),
  );

  final filledButtonTheme = FilledButtonThemeData(
    style: FilledButton.styleFrom(
      backgroundColor: tokens.primary,
      foregroundColor:
          mode == VisualMode.cinematic ? const Color(0xFF040712) : Colors.white,
      minimumSize: const Size(0, 48),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
    ),
  );

  final outlinedButtonTheme = OutlinedButtonThemeData(
    style: OutlinedButton.styleFrom(
      foregroundColor: tokens.onSurface,
      side: BorderSide(color: tokens.frame),
      minimumSize: const Size(0, 48),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500),
    ),
  );

  final iconButtonTheme = IconButtonThemeData(
    style: IconButton.styleFrom(
      foregroundColor: tokens.onSurface.withValues(alpha: 0.6),
    ),
  );

  final dividerTheme = DividerThemeData(
    color: mode == VisualMode.cinematic
        ? Colors.white.withValues(alpha: 0.06)
        : Colors.black.withValues(alpha: 0.06),
    thickness: 0.5,
    space: 0.5,
  );

  final snackBarTheme = SnackBarThemeData(
    behavior: SnackBarBehavior.floating,
    backgroundColor: mode == VisualMode.cinematic
        ? const Color(0xFF1A2340)
        : const Color(0xFF323232),
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    elevation: 4,
  );

  final drawerTheme = DrawerThemeData(
    backgroundColor: mode == VisualMode.cinematic
        ? const Color(0xFF0A1020)
        : const Color(0xFFF8FAFD),
    surfaceTintColor: Colors.transparent,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.horizontal(right: Radius.circular(0)),
    ),
  );

  final bottomSheetTheme = BottomSheetThemeData(
    backgroundColor:
        mode == VisualMode.cinematic ? const Color(0xFF0B1226) : Colors.white,
    surfaceTintColor: Colors.transparent,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
  );

  switch (mode) {
    case VisualMode.classic:
      return ThemeData(
        useMaterial3: true,
        brightness: Brightness.light,
        colorScheme: dynamicScheme != null
            ? dynamicScheme.copyWith(
                primary: tokens.primary,
                secondary: tokens.secondary,
              )
            : ColorScheme.light(
                primary: tokens.primary,
                secondary: tokens.secondary,
                surface: tokens.surface,
                onSurface: tokens.onSurface,
              ),
        scaffoldBackgroundColor: tokens.scaffold,
        cardTheme: CardThemeData(
          color: tokens.card,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: BorderSide(color: tokens.frame.withValues(alpha: 0.4)),
          ),
        ),
        textTheme: textTheme,
        appBarTheme: appBarTheme,
        inputDecorationTheme: inputDecoration,
        filledButtonTheme: filledButtonTheme,
        outlinedButtonTheme: outlinedButtonTheme,
        iconButtonTheme: iconButtonTheme,
        dividerTheme: dividerTheme,
        snackBarTheme: snackBarTheme,
        drawerTheme: drawerTheme,
        bottomSheetTheme: bottomSheetTheme,
        splashFactory: InkSparkle.splashFactory,
        extensions: [semanticColors],
      );
    case VisualMode.cinematic:
      return ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        colorScheme: dynamicScheme != null
            ? dynamicScheme.copyWith(
                primary: tokens.primary,
                secondary: tokens.secondary,
                surface: tokens.surface,
                onSurface: tokens.onSurface,
              )
            : ColorScheme.dark(
                primary: tokens.primary,
                secondary: tokens.secondary,
                surface: tokens.surface,
                onSurface: tokens.onSurface,
              ),
        scaffoldBackgroundColor: tokens.scaffold,
        cardTheme: CardThemeData(
          color: tokens.card,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: BorderSide(color: tokens.frame),
          ),
        ),
        textTheme: textTheme,
        appBarTheme: appBarTheme,
        inputDecorationTheme: inputDecoration,
        filledButtonTheme: filledButtonTheme,
        outlinedButtonTheme: outlinedButtonTheme,
        iconButtonTheme: iconButtonTheme,
        dividerTheme: dividerTheme,
        snackBarTheme: snackBarTheme,
        drawerTheme: drawerTheme,
        bottomSheetTheme: bottomSheetTheme,
        splashFactory: InkSparkle.splashFactory,
        extensions: [semanticColors],
      );
  }
}
