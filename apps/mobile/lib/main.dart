import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/app_providers.dart';
import 'theme/app_theme.dart';
import 'services/socket_service.dart';
import 'services/api_service.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/register_screen.dart';
import 'screens/chat/chat_list_screen.dart';
import 'screens/feed/feed_screen.dart';
import 'screens/location/location_screen.dart';
import 'screens/notifications/notifications_screen.dart';
import 'screens/profile/profile_screen.dart';

void main() {
  runApp(const TimQuanhDayApp());
}

class TimQuanhDayApp extends StatelessWidget {
  const TimQuanhDayApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()..init()),
        ChangeNotifierProvider(create: (_) => ChatProvider()),
        ChangeNotifierProvider(create: (_) => NotificationProvider()),
      ],
      child: MaterialApp(
        title: 'TimQuanhDay',
        theme: AppTheme.theme,
        debugShowCheckedModeBanner: false,
        initialRoute: '/splash',
        routes: {
          '/splash': (context) => const SplashScreen(),
          '/login': (context) => const LoginScreen(),
          '/register': (context) => const RegisterScreen(),
          '/home': (context) => const HomeScreen(),
        },
      ),
    );
  }
}

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});
  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    await Future.delayed(const Duration(milliseconds: 500));
    if (!mounted) return;
    final auth = context.read<AuthProvider>();
    if (auth.isLoggedIn) {
      // Connect socket
      final token = await ApiService().getToken();
      if (token != null) {
        SocketService().connect(token);
      }
      Navigator.pushReplacementNamed(context, '/home');
    } else {
      Navigator.pushReplacementNamed(context, '/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 80, height: 80,
              decoration: BoxDecoration(
                color: AppTheme.primaryLight,
                borderRadius: BorderRadius.circular(24),
              ),
              child: const Icon(Icons.chat_bubble_rounded, size: 40, color: AppTheme.primary),
            ),
            const SizedBox(height: 16),
            const Text('TimQuanhDay', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppTheme.primary)),
            const SizedBox(height: 24),
            const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2.5)),
          ],
        ),
      ),
    );
  }
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

  final _screens = [
    const ChatListScreen(),
    const FeedScreen(),
    const LocationScreen(),
    const NotificationsScreen(),
    const ProfileScreen(),
  ];

  @override
  void initState() {
    super.initState();
    // Connect socket after auth is ready
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final token = await ApiService().getToken();
      if (token != null) {
        SocketService().connect(token);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _currentIndex, children: _screens),
      bottomNavigationBar: Consumer<NotificationProvider>(
        builder: (context, notif, _) {
          final notifUnread = notif.unreadCount;
          return BottomNavigationBar(
            currentIndex: _currentIndex,
            onTap: (i) {
              setState(() => _currentIndex = i);
              // Refresh notifications when switching to the tab
              if (i == 3) notif.fetchNotifications();
            },
            items: const [
              BottomNavigationBarItem(icon: Icon(Icons.chat_bubble_outline), activeIcon: Icon(Icons.chat_bubble), label: 'Tin nhắn'),
              BottomNavigationBarItem(icon: Icon(Icons.explore_outlined), activeIcon: Icon(Icons.explore), label: 'Khám phá'),
              BottomNavigationBarItem(icon: Icon(Icons.map_outlined), activeIcon: Icon(Icons.map), label: 'Vị trí'),
              BottomNavigationBarItem(
                icon: _BadgedIcon(
                  icon: Icons.notifications_outlined,
                  badge: notifUnread,
                  active: false,
                ),
                activeIcon: _BadgedIcon(
                  icon: Icons.notifications,
                  badge: notifUnread,
                  active: true,
                ),
                label: 'Thông báo',
              ),
              BottomNavigationBarItem(icon: Icon(Icons.person_outline), activeIcon: Icon(Icons.person), label: 'Cá nhân'),
            ],
          );
        },
      ),
    );
  }
}

/// Wraps an icon with a badge count (material-style)
class _BadgedIcon extends StatelessWidget {
  final IconData icon;
  final int badge;
  final bool active;
  const _BadgedIcon({required this.icon, required this.badge, required this.active});

  @override
  Widget build(BuildContext context) {
    final color = active ? AppTheme.primary : AppTheme.textTertiary;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Icon(icon, color: color),
        if (badge > 0)
          Positioned(
            right: -8,
            top: -4,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
              decoration: BoxDecoration(
                color: AppTheme.primary,
                borderRadius: BorderRadius.circular(8),
              ),
              constraints: const BoxConstraints(minWidth: 14),
              child: Text(
                badge > 99 ? '99+' : '$badge',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 9, color: Colors.white, fontWeight: FontWeight.bold),
              ),
            ),
          ),
      ],
    );
  }
}