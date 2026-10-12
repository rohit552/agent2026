import 'package:flutter/material.dart';
import 'screens/home_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const SkillHeedApp());
}

class SkillHeedApp extends StatelessWidget {
  const SkillHeedApp({super.key});

  @override
  Widget build(BuildContext context) {
    const blue = Color(0xFF1769FF);
    return MaterialApp(
      title: 'SkillHeed',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: blue),
        scaffoldBackgroundColor: const Color(0xFFF7FAFF),
        cardTheme: CardThemeData(color: Colors.white, elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20), side: const BorderSide(color: Color(0xFFE7EDF6)))),
      ),
      home: const HomeScreen(),
    );
  }
}
