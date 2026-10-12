# SkillHeed Mobile

Flutter application starter with a branded home screen and API health check.

## Run
```bash
flutter pub get
flutter run --dart-define=SKILLHEED_API_URL=http://10.0.2.2:4000
```

For Android emulator, `10.0.2.2` points to the host machine. For iOS simulator use `http://localhost:4000`. For a physical device use the development machine's LAN IP. Use HTTPS in production.

Authentication, role-specific screens, push notifications, payments and individual product modules still require implementation and device QA.
