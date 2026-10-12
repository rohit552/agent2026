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


  Future<Map<String, dynamic>> educationSummary() async {
    final token = await _storage.read(key: _tokenKey);
    if (token == null || token.isEmpty) {
      throw const ApiException('Sign in to view your education dashboard', 401);
    }
    final profileId = await _storage.read(key: _profileKey);
    final user = _normaliseUser(await _api.get('/api/v1/auth/me', token: token, profileId: profileId));
    final role = user['activeRole']?.toString() ?? user['role']?.toString() ?? 'STUDENT';
    if (!['STUDENT', 'TEACHER', 'INSTITUTION_ADMIN', 'PLATFORM_ADMIN', 'SUPER_ADMIN'].contains(role)) {
      return {'classes': <dynamic>[], 'courses': <dynamic>[], 'attendance': <dynamic>[], 'assessments': <dynamic>[], 'activeRole': role};
    }

    final classesResponse = await _api.get('/api/v1/education/classes', token: token, profileId: profileId);
    final coursesResponse = await _api.get('/api/v1/education/courses', token: token, profileId: profileId);
    final assessmentsResponse = await _api.get('/api/v1/assessments', token: token, profileId: profileId);
    List<dynamic> attendance = <dynamic>[];
    if (role == 'STUDENT') {
      final attendanceResponse = await _api.get('/api/v1/education/me/attendance', token: token, profileId: profileId);
      final data = Map<String, dynamic>.from(attendanceResponse['data'] as Map);
      attendance = data['records'] as List<dynamic>? ?? <dynamic>[];
    }
    return {
      'classes': (Map<String, dynamic>.from(classesResponse['data'] as Map)['classes'] as List<dynamic>? ?? <dynamic>[]),
      'courses': (Map<String, dynamic>.from(coursesResponse['data'] as Map)['courses'] as List<dynamic>? ?? <dynamic>[]),
      'attendance': attendance,
      'assessments': (Map<String, dynamic>.from(assessmentsResponse['data'] as Map)['assessments'] as List<dynamic>? ?? <dynamic>[]),
      'activeRole': role,
    };
  }

  Future<List<Map<String, dynamic>>> courseLessons(String courseId) async {
    final token = await _storage.read(key: _tokenKey);
    if (token == null || token.isEmpty) throw const ApiException('Sign in to view course lessons', 401);
    final profileId = await _storage.read(key: _profileKey);
    final response = await _api.get('/api/v1/education/courses/$courseId/lessons', token: token, profileId: profileId);
    final data = Map<String, dynamic>.from(response['data'] as Map);
    final lessons = data['lessons'] as List<dynamic>? ?? <dynamic>[];
    return lessons.map((item) => Map<String, dynamic>.from(item as Map)).toList();
  }


  Future<Map<String, dynamic>> startAssessment(String assessmentId) async {
    final token = await _storage.read(key: _tokenKey);
    if (token == null || token.isEmpty) throw const ApiException('Sign in to start an assessment', 401);
    final profileId = await _storage.read(key: _profileKey);
    final response = await _api.post('/api/v1/assessments/$assessmentId/attempts', const {}, token: token, profileId: profileId);
    return Map<String, dynamic>.from(response['data'] as Map);
  }

  Future<void> saveAssessmentAnswer(String attemptId, String questionId, dynamic answer) async {
    final token = await _storage.read(key: _tokenKey);
    if (token == null || token.isEmpty) throw const ApiException('Sign in to save assessment answers', 401);
    final profileId = await _storage.read(key: _profileKey);
    await _api.post('/api/v1/assessments/attempts/$attemptId/answers/$questionId', {'answer': answer}, token: token, profileId: profileId);
  }

  Future<Map<String, dynamic>> submitAssessmentAttempt(String attemptId) async {
    final token = await _storage.read(key: _tokenKey);
    if (token == null || token.isEmpty) throw const ApiException('Sign in to submit an assessment', 401);
    final profileId = await _storage.read(key: _profileKey);
    final response = await _api.post('/api/v1/assessments/attempts/$attemptId/submit', const {}, token: token, profileId: profileId);
    return Map<String, dynamic>.from(response['data'] as Map);
  }

  Future<Map<String, dynamic>> getAssessmentAttempt(String attemptId) async {
    final token = await _storage.read(key: _tokenKey);
    if (token == null || token.isEmpty) throw const ApiException('Sign in to view assessment results', 401);
    final profileId = await _storage.read(key: _profileKey);
    final response = await _api.get('/api/v1/assessments/attempts/$attemptId', token: token, profileId: profileId);
    return Map<String, dynamic>.from(response['data'] as Map);
  }


  Future<Map<String, dynamic>> assessmentHistory() async {
    final token = await _storage.read(key: _tokenKey);
    if (token == null || token.isEmpty) {
      throw const ApiException('Sign in to view assessment history', 401);
    }
    final profileId = await _storage.read(key: _profileKey);
    final response = await _api.get('/api/v1/assessment-analytics/me', token: token, profileId: profileId);
    return Map<String, dynamic>.from(response['data'] as Map);
  }

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
