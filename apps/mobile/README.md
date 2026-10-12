# SkillHeed Mobile

Flutter app foundation with a branded home screen, API health check, login/register flow and secure storage for access tokens.

## One-time local setup

Requirements: Flutter stable and an Android SDK for Android builds.

From this directory generate native project files for the platforms you need:

    flutter create --platforms=android,ios --project-name=skillheed_mobile --no-pub .

Then resolve dependencies and run:

    flutter pub get
    flutter run --dart-define=SKILLHEED_API_URL=http://10.0.2.2:4000

For Android emulator, 10.0.2.2 points to the host machine. For iOS simulator use http://localhost:4000. For a physical device use the development machine's LAN IP. Use HTTPS in production.

The app calls the Node API for account registration, login, profile restoration and health checks. Access tokens are stored using flutter_secure_storage. Newly registered accounts remain pending until verification/approval is configured. Role-specific product screens, refresh-session handling, push notifications, payments, iOS project setup and production-device QA remain release work.
