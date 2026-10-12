import 'dart:convert';
import 'package:http/http.dart' as http;

/// Override via: flutter run --dart-define=SKILLHEED_API_URL=https://api.example.com
class ApiClient {
  ApiClient({http.Client? client}) : _client = client ?? http.Client();
  final http.Client _client;
  static const _baseUrl = String.fromEnvironment('SKILLHEED_API_URL', defaultValue: 'http://10.0.2.2:4000');

  Future<Map<String, dynamic>> getHealth() async {
    final response = await _client.get(Uri.parse('$_baseUrl/health')).timeout(const Duration(seconds: 10));
    final body = jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException('Health check failed', response.statusCode);
    }
    return Map<String, dynamic>.from(body as Map);
  }
}

class ApiException implements Exception {
  const ApiException(this.message, this.statusCode);
  final String message;
  final int statusCode;
  @override
  String toString() => 'ApiException($statusCode): $message';
}
