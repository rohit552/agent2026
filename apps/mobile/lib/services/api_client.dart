import 'dart:convert';
import 'package:http/http.dart' as http;

/// Override via: flutter run --dart-define=SKILLHEED_API_URL=https://api.example.com
class ApiClient {
  ApiClient({http.Client? client}) : _client = client ?? http.Client();
  final http.Client _client;
  static const _baseUrl = String.fromEnvironment('SKILLHEED_API_URL', defaultValue: 'http://10.0.2.2:4000');

  Future<Map<String, dynamic>> getHealth() => get('/health');

  Future<Map<String, dynamic>> get(String path, {String? token}) async {
    final response = await _client.get(Uri.parse('$_baseUrl$path'), headers: {
      if (token != null) 'Authorization': 'Bearer $token',
      'Accept': 'application/json',
    }).timeout(const Duration(seconds: 12));
    return _decode(response);
  }

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> payload) async {
    final response = await _client.post(Uri.parse('$_baseUrl$path'),
      headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
      body: jsonEncode(payload),
    ).timeout(const Duration(seconds: 12));
    return _decode(response);
  }

  Map<String, dynamic> _decode(http.Response response) {
    Map<String, dynamic> body;
    try { body = Map<String, dynamic>.from(jsonDecode(response.body) as Map); }
    catch (_) { body = {'error': {'message': 'The server returned an invalid response'}}; }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final error = body['error'];
      final message = error is Map && error['message'] is String ? error['message'] as String : 'Request failed';
      throw ApiException(message, response.statusCode);
    }
    return body;
  }
}

class ApiException implements Exception {
  const ApiException(this.message, this.statusCode);
  final String message;
  final int statusCode;
  @override
  String toString() => 'ApiException($statusCode): $message';
}
