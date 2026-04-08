import 'package:flutter/material.dart';

class SvenAppIcon extends StatelessWidget {
  const SvenAppIcon({
    super.key,
    this.size = 40,
    this.borderRadius,
  });

  final double size;
  final double? borderRadius;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius ?? size * 0.28),
      child: Image.asset(
        'assets/images/sven_app_icon.png',
        width: size,
        height: size,
        fit: BoxFit.cover,
      ),
    );
  }
}
