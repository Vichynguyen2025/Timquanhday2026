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
      await context.read<AuthProvider>().register(
        _nameCtrl.text.trim(),
        _emailCtrl.text.trim(),
        _passCtrl.text,
      );
      if (mounted) Navigator.pushReplacementNamed(context, '/home');
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 28),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Logo
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: AppTheme.primary,
                      borderRadius: BorderRadius.circular(18),
                      boxShadow: [
                        BoxShadow(
                          color: AppTheme.primary.withOpacity(0.2),
                          blurRadius: 16,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.explore_rounded,
                      size: 32,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'Đăng ký',
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF171717),
                      letterSpacing: -0.56,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Tạo tài khoản mới',
                    style: TextStyle(
                      fontSize: 15,
                      color: AppTheme.textSecondary,
                      letterSpacing: -0.15,
                    ),
                  ),
                  const SizedBox(height: 36),

                  // Error
                  if (_error != null)
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppTheme.error.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(10),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x19000000),
                            blurRadius: 0,
                            offset: Offset(0, 0),
                            spreadRadius: 1,
                          ),
                        ],
                      ),
                      child: Text(_error!, style: const TextStyle(color: AppTheme.error, fontSize: 13)),
                    ),
                  if (_error != null) const SizedBox(height: 16),

                  // Name
                  _buildField(
                    controller: _nameCtrl,
                    label: 'Họ tên',
                    hint: 'Nhập tên của bạn',
                    icon: Icons.person_outline,
                    validator: (v) => (v == null || v.isEmpty) ? 'Vui lòng nhập tên' : null,
                  ),
                  const SizedBox(height: 14),

                  // Email
                  _buildField(
                    controller: _emailCtrl,
                    label: 'Email',
                    hint: 'Nhập email',
                    icon: Icons.mail_outline,
                    keyboardType: TextInputType.emailAddress,
                    validator: (v) => (v == null || v.isEmpty) ? 'Vui lòng nhập email' : null,
                  ),
                  const SizedBox(height: 14),

                  // Password
                  Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x14000000),
                          blurRadius: 0,
                          offset: Offset(0, 0),
                          spreadRadius: 1,
                        ),
                      ],
                    ),
                    child: TextFormField(
                      controller: _passCtrl,
                      obscureText: _obscure,
                      decoration: InputDecoration(
                        labelText: 'Mật khẩu',
                        hintText: 'Tối thiểu 6 ký tự',
                        prefixIcon: Icon(Icons.lock_outline, size: 20, color: AppTheme.textTertiary),
                        suffixIcon: IconButton(
                          icon: Icon(_obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 20, color: AppTheme.textTertiary),
                          onPressed: () => setState(() => _obscure = !_obscure),
                        ),
                        filled: true,
                        fillColor: Colors.white,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide.none,
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide.none,
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: AppTheme.primary, width: 1.5),
                        ),
                        labelStyle: const TextStyle(color: AppTheme.textSecondary, fontSize: 14),
                        hintStyle: const TextStyle(color: AppTheme.textTertiary, fontSize: 14),
                      ),
                      validator: (v) => (v == null || v.length < 6) ? 'Mật khẩu tối thiểu 6 ký tự' : null,
                    ),
                  ),
                  const SizedBox(height: 28),

                  // Register button
                  SizedBox(
                    height: 50,
                    child: ElevatedButton(
                      onPressed: _loading ? null : _register,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF171717),
                        foregroundColor: Colors.white,
                        disabledBackgroundColor: const Color(0xFF171717).withOpacity(0.5),
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: _loading
                        ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                        : const Text('Đăng ký', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, letterSpacing: -0.16)),
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Login link
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: RichText(
                      text: TextSpan(
                        text: 'Đã có tài khoản? ',
                        style: const TextStyle(color: AppTheme.textSecondary, fontSize: 14),
                        children: [
                          TextSpan(
                            text: 'Đăng nhập',
                            style: TextStyle(
                              color: AppTheme.primary,
                              fontWeight: FontWeight.w600,
                              decoration: TextDecoration.underline,
                              decorationColor: AppTheme.primary.withOpacity(0.3),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required IconData icon,
    TextInputType? keyboardType,
    String? Function(String?)? validator,
  }) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        boxShadow: const [
          BoxShadow(
            color: Color(0x14000000),
            blurRadius: 0,
            offset: Offset(0, 0),
            spreadRadius: 1,
          ),
        ],
      ),
      child: TextFormField(
        controller: controller,
        keyboardType: keyboardType,
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          prefixIcon: Icon(icon, size: 20, color: AppTheme.textTertiary),
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide.none,
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide.none,
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: AppTheme.primary, width: 1.5),
          ),
          labelStyle: const TextStyle(color: AppTheme.textSecondary, fontSize: 14),
          hintStyle: const TextStyle(color: AppTheme.textTertiary, fontSize: 14),
        ),
        validator: validator,
      ),
    );
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }
}