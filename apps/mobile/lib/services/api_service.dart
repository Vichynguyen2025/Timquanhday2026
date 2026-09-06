import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_config.dart';

class ApiService {
  static final ApiService _instance = ApiService._();
  factory ApiService() => _instance;
  ApiService._();

  String? _token;

  Future<void> setToken(String token) async {
    _token = token;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('accessToken', token);
  }

  Future<void> clearToken() async {
    _token = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('accessToken');
  }

  Future<String?> getToken() async {
    if (_token != null) return _token;
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('accessToken');
    return _token;
  }

  Future<Map<String, String>> _headers() async {
    final token = await getToken();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  Future<Map<String, dynamic>> get(String endpoint, {Map<String, String>? query}) async {
    try {
      var uri = Uri.parse('${ApiConfig.apiUrl}$endpoint');
      if (query != null) uri = uri.replace(queryParameters: query);
      final response = await http.get(uri, headers: await _headers()).timeout(ApiConfig.timeout);
      if (response.statusCode == 401) {
        await clearToken();
        throw Exception('Session expired');
      }
      if (response.statusCode >= 400) {
        final body = jsonDecode(response.body);
        throw Exception(body['error'] ?? 'Request failed');
      }
      return {'data': jsonDecode(response.body)};
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception('Network error: $e');
    }
  }

  Future<Map<String, dynamic>> post(String endpoint, {Map<String, dynamic>? body}) async {
    try {
      final response = await http.post(
        Uri.parse('${ApiConfig.apiUrl}$endpoint'),
        headers: await _headers(),
        body: body != null ? jsonEncode(body) : null,
      ).timeout(ApiConfig.timeout);
      if (response.statusCode == 401) {
        await clearToken();
        throw Exception('Session expired');
      }
      if (response.statusCode >= 400) {
        final resp = jsonDecode(response.body);
        throw Exception(resp['error'] ?? 'Request failed');
      }
      return {'data': jsonDecode(response.body)};
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception('Network error: $e');
    }
  }

  Future<Map<String, dynamic>> delete(String endpoint) async {
    try {
      final response = await http.delete(
        Uri.parse('${ApiConfig.apiUrl}$endpoint'),
        headers: await _headers(),
      ).timeout(ApiConfig.timeout);
      if (response.statusCode >= 400) {
        final resp = jsonDecode(response.body);
        throw Exception(resp['error'] ?? 'Request failed');
      }
      return {'data': jsonDecode(response.body)};
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception('Network error: $e');
    }
  }

  Future<Map<String, dynamic>> patch(String endpoint, {Map<String, dynamic>? body}) async {
    try {
      final response = await http.patch(
        Uri.parse('${ApiConfig.apiUrl}$endpoint'),
        headers: await _headers(),
        body: body != null ? jsonEncode(body) : null,
      ).timeout(ApiConfig.timeout);
      if (response.statusCode >= 400) {
        final resp = jsonDecode(response.body);
        throw Exception(resp['error'] ?? 'Request failed');
      }
      return {'data': jsonDecode(response.body)};
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception('Network error: $e');
    }
  }

  Future<Map<String, dynamic>> uploadImage(String filePath) async {
    try {
      final token = await getToken();
      final uri = Uri.parse('${ApiConfig.apiUrl}${ApiConfig.upload}');
      final request = http.MultipartRequest('POST', uri);
      request.headers['Authorization'] = 'Bearer $token';
      request.files.add(await http.MultipartFile.fromPath('image', filePath));
      final streamed = await request.send().timeout(const Duration(minutes: 2));
      final response = await http.Response.fromStream(streamed);
      if (response.statusCode >= 400) {
        final resp = jsonDecode(response.body);
        throw Exception(resp['error'] ?? 'Upload failed');
      }
      return {'data': jsonDecode(response.body)};
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception('Upload error: $e');
    }
  }
}