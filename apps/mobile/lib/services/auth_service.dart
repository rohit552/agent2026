import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'api_client.dart';

class AuthService {
  AuthService({ApiClient? api, FlutterSecureStorage? storage})
      : _api = api ?? ApiClient(),
        _storage = storage ?? const FlutterSecureStorage();

  final ApiClient _api;
  final FlutterSecureStorage _storage;
  static const _tokenKey = 'skillheed.access_token';
  static const _profileKey = 'skillheed.active_profile_id';

  Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await _api.post('/api/v1/auth/login', {
      'email': email.trim(),
      'password': password,
    });
    final data = Map<String, dynamic>.from(response['data'] as Map);
    final token = data['accessToken'];
    if (token is! String || token.isEmpty) {
      throw const ApiException('The server did not return a session token', 502);
    }
    await _storage.write(key: _tokenKey, value: token);
    await _storage.delete(key: _profileKey);
    final hydrated = await currentUser();
    if (hydrated == null) throw const ApiException('The account could not be loaded', 502);
    return hydrated;
  }

  Future<Map<String, dynamic>> register({
    required String fullName,
    required String email,
    required String password,
    required String role,
  }) async {
    final response = await _api.post('/api/v1/auth/register', {
      'fullName': fullName.trim(),
      'email': email.trim(),
      'password': password,
      'role': role,
    });
    return Map<String, dynamic>.from(response['data'] as Map);
  }

  Future<Map<String, dynamic>?> currentUser() async {
    final token = await _storage.read(key: _tokenKey);
    if (token == null || token.isEmpty) return null;

    var profileId = await _storage.read(key: _profileKey);
    try {
      var response = await _api.get('/api/v1/auth/me', token: token, profileId: profileId);
      var user = _normaliseUser(response);

      // Respect the administrator-assigned default profile in this mobile client.
      if (profileId == null) {
        final roles = user['profileRoles'];
        if (roles is List) {
          for (final item in roles) {
            if (item is Map && item['active'] == true && item['isDefault'] == true && item['id'] is String) {
              profileId = item['id'] as String;
              await _storage.write(key: _profileKey, value: profileId);
              response = await _api.get('/api/v1/auth/me', token: token, profileId: profileId);
              user = _normaliseUser(response);
              break;
            }
          }
        }
      }
      return user;
    } on ApiException catch (error) {
      if (error.statusCode == 403 && profileId != null) {
        // A role could have been revoked; clear only that selection and retry the base account.
        await _storage.delete(key: _profileKey);
        try {
          return _normaliseUser(await _api.get('/api/v1/auth/me', token: token));
        } on ApiException catch (retryError) {
          if (retryError.statusCode == 401 || retryError.statusCode == 403) {
            await logout();
            return null;
          }
          rethrow;
        }
      }
      if (error.statusCode == 401 || error.statusCode == 403) {
        await logout();
        return null;
      }
      rethrow;
    }
  }

  Future<void> selectProfile(String profileId) async {
    await _storage.write(key: _profileKey, value: profileId);
  }

  Future<void> clearSelectedProfile() async {
    await _storage.delete(key: _profileKey);
  }

  Future<String?> selectedProfileId() => _storage.read(key: _profileKey);

  Future<void> logout() async {
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _profileKey);
  }

  Map<String, dynamic> _normaliseUser(Map<String, dynamic> response) {
    final data = Map<String, dynamic>.from(response['data'] as Map);
    final user = Map<String, dynamic>.from(data['user'] as Map);
    user['activeRole'] = data['activeRole'] ?? user['role'];
    user['activeProfile'] = data['activeProfile'];
    return user;
  }
}
