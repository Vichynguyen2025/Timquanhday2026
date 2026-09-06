import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/app_providers.dart';
import '../../theme/app_theme.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    final initial = (user?.name ?? '?')[0].toUpperCase();

    return Scaffold(
      appBar: AppBar(title: const Text('Cá nhân')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            const SizedBox(height: 20),
            CircleAvatar(
              radius: 48,
              backgroundColor: AppTheme.primaryLight,
              child: Text(initial, style: const TextStyle(fontSize: 36, fontWeight: FontWeight.bold, color: AppTheme.primary)),
            ),
            const SizedBox(height: 16),
            Text(user?.name ?? '', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: AppTheme.textPrimary)),
            const SizedBox(height: 4),
            Text(user?.email ?? '', style: const TextStyle(fontSize: 14, color: AppTheme.textSecondary)),
            const SizedBox(height: 32),
            Card(
              child: Column(
                children: [
                  ListTile(
                    leading: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(color: AppTheme.primaryLight, borderRadius: BorderRadius.circular(10)),
                      child: const Icon(Icons.person_outline, color: AppTheme.primary, size: 20),
                    ),
                    title: const Text('Tên', style: TextStyle(fontSize: 13, color: AppTheme.textSecondary)),
                    subtitle: Text(user?.name ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                  ),
                  const Divider(height: 1, indent: 56),
                  ListTile(
                    leading: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(color: AppTheme.primaryLight, borderRadius: BorderRadius.circular(10)),
                      child: const Icon(Icons.email_outlined, color: AppTheme.primary, size: 20),
                    ),
                    title: const Text('Email', style: TextStyle(fontSize: 13, color: AppTheme.textSecondary)),
                    subtitle: Text(user?.email ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                  ),
                  if (user?.phone != null && user!.phone!.isNotEmpty) ...[
                    const Divider(height: 1, indent: 56),
                    ListTile(
                      leading: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(color: AppTheme.primaryLight, borderRadius: BorderRadius.circular(10)),
                        child: const Icon(Icons.phone_outlined, color: AppTheme.primary, size: 20),
                      ),
                      title: const Text('Số điện thoại', style: TextStyle(fontSize: 13, color: AppTheme.textSecondary)),
                      subtitle: Text(user.phone!, style: const TextStyle(fontWeight: FontWeight.w600)),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity, height: 50,
              child: OutlinedButton.icon(
                onPressed: () async {
                  await context.read<AuthProvider>().logout();
                  if (context.mounted) Navigator.pushReplacementNamed(context, '/login');
                },
                icon: const Icon(Icons.logout, color: AppTheme.error),
                label: const Text('Đăng xuất', style: TextStyle(color: AppTheme.error, fontSize: 16)),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: AppTheme.error),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}