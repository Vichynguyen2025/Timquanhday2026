class ApiConfig {
  static const String baseUrl = 'https://timquanhday.de';
  static const String apiUrl = '$baseUrl/api';
  static const String socketUrl = baseUrl;
  static const String socketPath = '/ws';
  static const Duration timeout = Duration(seconds: 30);

  // Endpoints
  static const String login = '/auth/login';
  static const String register = '/auth/register';
  static const String me = '/auth/me';
  static const String conversations = '/conversations';
  static const String messages = '/messages';
  static const String upload = '/upload/image';
  static const String notifications = '/notifications';
  static const String posts = '/posts';
  static const String location = '/location';
}