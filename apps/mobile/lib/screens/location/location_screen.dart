import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';

class LocationScreen extends StatefulWidget {
  const LocationScreen({super.key});
  @override
  State<LocationScreen> createState() => _LocationScreenState();
}

class _LocationScreenState extends State<LocationScreen> {
  final _api = ApiService();
  List _users = [];
  bool _loading = true;
  int _radius = 500;
  double? _lat, _lng;

  @override
  void initState() {
    super.initState();
    _fetchNearby();
  }

  Future<void> _fetchNearby() async {
    setState(() => _loading = true);
    try {
      final res = await _api.get('/location/nearby', query: {'radius': '$_radius'});
      _users = res['data'] as List? ?? [];
    } catch (_) {}
    setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Vị trí')),
      body: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: const BoxDecoration(color: AppTheme.surface, border: Border(bottom: BorderSide(color: AppTheme.border))),
            child: Row(children: [
              const Text('Bán kính: ', style: TextStyle(fontSize: 14, color: AppTheme.textSecondary)),
              Expanded(
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [100, 200, 500, 1000, 5000].map((r) => Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(r >= 1000 ? '${r ~/ 1000}km' : '${r}m', style: TextStyle(fontSize: 12, color: _radius == r ? Colors.white : AppTheme.textPrimary)),
                        selected: _radius == r,
                        selectedColor: AppTheme.primary,
                        onSelected: (_) { setState(() => _radius = r); _fetchNearby(); },
                      ),
                    )).toList(),
                  ),
                ),
              ),
            ]),
          ),
          Expanded(
            child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _users.isEmpty
                ? Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Icon(Icons.map_outlined, size: 60, color: AppTheme.textTertiary.withOpacity(0.4)),
                    const SizedBox(height: 16),
                    const Text('Không tìm thấy người dùng gần đây', style: TextStyle(fontSize: 15, color: AppTheme.textSecondary)),
                  ]))
                : ListView.builder(
                    itemCount: _users.length,
                    padding: const EdgeInsets.all(16),
                    itemBuilder: (context, i) {
                      final u = _users[i];
                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: AppTheme.primaryLight,
                            child: Text((u['name'] ?? '?')[0]?.toUpperCase() ?? '?', style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primary)),
                          ),
                          title: Text(u['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                          subtitle: Text(u['distance'] != null ? '${(u['distance'] as num).toStringAsFixed(0)}m' : '', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                          trailing: u['is_online'] == 1 ? Container(width: 10, height: 10, decoration: const BoxDecoration(color: AppTheme.online, shape: BoxShape.circle)) : null,
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}