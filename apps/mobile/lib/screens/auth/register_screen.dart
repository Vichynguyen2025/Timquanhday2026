import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import 'package:provider/provider.dart';
import '../../providers/app_providers.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});
  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _loading = false, _obscure = true;
  String? _error;

  Future<void> _register() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _loading = true; _error = null; });
    try {
      await context.read<AuthProvider>().register(_nameCtrl.text.trim(), _emailCtrl.text.trim(), _passCtrl.text);
      if (mounted) Navigator.pushReplacementNamed(context, '/home');
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              const SizedBox(height: 40),
              const Text('Đăng ký', style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: AppTheme.textPrimary)),
              const SizedBox(height: 8),
              const Text('Tạo tài khoản mới', style: TextStyle(fontSize: 15, color: AppTheme.textSecondary)),
              const SizedBox(height: 32),
              if (_error != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: AppTheme.error.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
                  child: Text(_error!, style: const TextStyle(color: AppTheme.error, fontSize: 13)),
                ),
              if (_error != null) const SizedBox(height: 16),
              TextFormField(controller: _nameCtrl, decoration: const InputDecoration(labelText: 'Họ tên', hintText: 'Nhập tên của bạn', prefixIcon: Icon(Icons.person_outline, size: 20)), validator: (v) => (v == null || v.isEmpty) ? 'Vui lòng nhập tên' : null),
              const SizedBox(height: 16),
              TextFormField(controller: _emailCtrl, decoration: const InputDecoration(labelText: 'Email', hintText: 'Nhập email', prefixIcon: Icon(Icons.mail_outline, size: 20)), keyboardType: TextInputType.emailAddress, validator: (v) => (v == null || v.isEmpty) ? 'Vui lòng nhập email' : null),
              const SizedBox(height: 16),
              TextFormField(controller: _passCtrl, obscureText: _obscure, decoration: InputDecoration(labelText: 'Mật khẩu', hintText: 'Tối thiểu 6 ký tự', prefixIcon: const Icon(Icons.lock_outline, size: 20), suffixIcon: IconButton(icon: Icon(_obscure ? Icons.visibility_off : Icons.visibility, size: 20), onPressed: () => setState(() => _obscure = !_obscure))), validator: (v) => (v == null || v.length < 6) ? 'Mật khẩu tối thiểu 6 ký tự' : null),
              const SizedBox(height: 24),
              SizedBox(height: 50, child: ElevatedButton(onPressed: _loading ? null : _register, child: _loading ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white)) : const Text('Đăng ký'))),
              const SizedBox(height: 16),
              TextButton(onPressed: () => Navigator.pop(context), child: RichText(text: TextSpan(text: 'Đã có tài khoản? ', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 14), children: [TextSpan(text: 'Đăng nhập', style: TextStyle(color: AppTheme.primary, fontWeight: FontWeight.w600))]))),
            ]),
          ),
        ),
      ),
    );
  }

  @override
  void dispose() { _nameCtrl.dispose(); _emailCtrl.dispose(); _passCtrl.dispose(); super.dispose(); }
}