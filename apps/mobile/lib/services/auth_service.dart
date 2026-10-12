import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'api_client.dart';

class AuthService {
  AuthService({ApiClient? api, FlutterSecureStorage? storage})
      : _api = api ?? ApiClient(),
        _storage = storage ?? const FlutterSecureStorage();

  final ApiClient _api;
  final FlutterSecureStorage _storage;
  static const _tokenKey = 'skillheed.access_token';

  Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await _api.post('/api/v1/auth/login', {'email': email.trim(), 'password': password});
    final data = Map<String, dynamic>.from(response['data'] as Map);
    final token = data['accessToken'];
    if (token is! String || token.isEmpty) throw const ApiException('The server did not return a session token', 502);
    await _storage.write(key: _tokenKey, value: token);
    return Map<String, dynamic>.from(data['user'] as Map);
  }

  Future<Map<String, dynamic>> register({required String fullName, required String email, required String password, required String role}) async {
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
    try {
      final response = await _api.get('/api/v1/auth/me', token: token);
      return Map<String, dynamic>.from(response['data']['user'] as Map);
    } on ApiException catch (error) {
      if (error.statusCode == 401 || error.statusCode == 403) {
        await logout();
        return null;
      }
      rethrow;
    }
  }

  Future<void> logout() => _storage.delete(key: _tokenKey);
}
