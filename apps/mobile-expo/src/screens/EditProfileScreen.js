import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, ScrollView, Modal, FlatList, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../theme/colors';

// ─── DATA LISTS ────────────────────────────
const GENDERS = ['Nam', 'Nữ', 'LGBT', 'Không chia sẻ'];

const BIRTH_YEARS = Array.from({ length: 61 }, (_, i) => (2025 - i).toString());

const PROVINCES = [
  'An Giang', 'Bà Rịa - Vũng Tàu', 'Bạc Liêu', 'Bắc Giang', 'Bắc Kạn',
  'Bắc Ninh', 'Bến Tre', 'Bình Dương', 'Bình Định', 'Bình Phước',
  'Bình Thuận', 'Cà Mau', 'Cao Bằng', 'Cần Thơ', 'Đà Nẵng',
  'Đắk Lắk', 'Đắk Nông', 'Điện Biên', 'Đồng Nai', 'Đồng Tháp',
  'Gia Lai', 'Hà Giang', 'Hà Nam', 'Hà Nội', 'Hà Tĩnh',
  'Hải Dương', 'Hải Phòng', 'Hậu Giang', 'Hòa Bình', 'TP. Hồ Chí Minh',
  'Hưng Yên', 'Khánh Hòa', 'Kiên Giang', 'Kon Tum', 'Lai Châu',
  'Lạng Sơn', 'Lào Cai', 'Lâm Đồng', 'Long An', 'Nam Định',
  'Nghệ An', 'Ninh Bình', 'Ninh Thuận', 'Phú Thọ', 'Phú Yên',
  'Quảng Bình', 'Quảng Nam', 'Quảng Ngãi', 'Quảng Ninh', 'Quảng Trị',
  'Sóc Trăng', 'Sơn La', 'Tây Ninh', 'Thái Bình', 'Thái Nguyên',
  'Thanh Hóa', 'Thừa Thiên Huế', 'Tiền Giang', 'Trà Vinh', 'Tuyên Quang',
  'Vĩnh Long', 'Vĩnh Phúc', 'Yên Bái',
];

const OCCUPATIONS = [
  'Học sinh', 'Sinh viên', 'Nhân viên văn phòng', 'Kỹ sư',
  'Giáo viên / Giảng viên', 'Bác sĩ / Y tá', 'Luật sư', 'Kế toán / Kiểm toán',
  'Nhân viên kinh doanh', 'Marketing / Truyền thông', 'Lập trình viên',
  'Thiết kế đồ họa', 'Nhà báo / Biên tập viên', 'Nội trợ',
  'Kinh doanh tự do', 'Quản lý / Điều hành', 'Lao động phổ thông',
  'Nghệ sĩ / Diễn viên', 'Đầu bếp / Phục vụ', 'Tài xế / Lái xe',
  'Nhân viên xây dựng', 'Công nhân', 'Bộ đội / Công an',
  'Hưu trí', 'Khác',
];

const UNIVERSITIES = [
  'Đại học Bách khoa Hà Nội', 'Đại học Bách khoa TP.HCM',
  'Đại học Công nghệ - ĐHQG Hà Nội', 'Đại học Khoa học Tự nhiên - ĐHQG TP.HCM',
  'Đại học Kinh tế Quốc dân', 'Đại học Ngoại thương',
  'Đại học Quốc gia Hà Nội', 'Đại học Quốc gia TP.HCM',
  'Học viện Công nghệ Bưu chính Viễn thông', 'Học viện Kỹ thuật Quân sự',
  'Đại học FPT', 'Đại học RMIT Việt Nam',
  'Đại học Sư phạm Hà Nội', 'Đại học Sư phạm TP.HCM',
  'Đại học Y Hà Nội', 'Đại học Y Dược TP.HCM',
  'Đại học Dược Hà Nội', 'Đại học Y Dược Cần Thơ',
  'Đại học Luật Hà Nội', 'Đại học Luật TP.HCM',
  'Đại học Kinh tế - Luật - ĐHQG TP.HCM', 'Đại học Kinh tế TP.HCM',
  'Học viện Ngân hàng', 'Đại học Ngân hàng TP.HCM',
  'Đại học Thương mại', 'Đại học Tài chính - Marketing',
  'Đại học Kiến trúc Hà Nội', 'Đại học Kiến trúc TP.HCM',
  'Đại học Xây dựng Hà Nội', 'Đại học Giao thông Vận tải',
  'Đại học Sư phạm Kỹ thuật TP.HCM', 'Đại học Công nghiệp Hà Nội',
  'Đại học Công nghiệp TP.HCM', 'Đại học Nông Lâm TP.HCM',
  'Học viện Nông nghiệp Việt Nam', 'Đại học Thủy lợi',
  'Đại học Mỏ - Địa chất', 'Đại học Dầu khí Việt Nam',
  'Đại học Hàng hải Việt Nam', 'Đại học Văn Lang',
  'Đại học Hoa Sen', 'Đại học Tôn Đức Thắng',
  'Đại học Nguyễn Tất Thành', 'Đại học Công nghệ Sài Gòn',
  'Cao đẳng FPT', 'Cao đẳng nghề',
  'Trung cấp chuyên nghiệp', 'Không',
];

// ─── Picker Modal ───────────────────────────
function PickerModal({ visible, title, data, value, onSelect, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={sModal.overlay}>
        <View style={sModal.container}>
          <View style={sModal.header}>
            <Text style={sModal.title}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#111827" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={data}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={{ paddingBottom: 20 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[sModal.item, value === item && sModal.itemActive]}
                onPress={() => { onSelect(item); onClose(); }}
              >
                <Text style={[sModal.itemText, value === item && sModal.itemTextActive]}>
                  {item}
                </Text>
                {value === item && <Ionicons name="checkmark" size={20} color={colors.primary} />}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

// ─── EditProfileScreen ──────────────────────
export default function EditProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, setUser } = useAuth();
  const initial = user || {};

  const [name, setName] = useState(initial.name || '');
  const [bio, setBio] = useState(initial.bio || '');
  const [gender, setGender] = useState(initial.gender || '');
  const [birthYear, setBirthYear] = useState(initial.birth_year?.toString() || '');
  const [hometown, setHometown] = useState(initial.hometown || '');
  const [occupation, setOccupation] = useState(initial.occupation || '');
  const [school, setSchool] = useState(initial.school || '');
  const [saving, setSaving] = useState(false);

  const [picker, setPicker] = useState(null); // 'gender' | 'birth' | 'hometown' | 'occupation' | 'school'

  async function handleSave() {
    if (!name.trim()) { Alert.alert('Vui lòng nhập tên'); return; }
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        bio: bio.trim(),
        gender: gender || null,
        birth_year: birthYear ? parseInt(birthYear) : null,
        hometown: hometown || null,
        occupation: occupation || null,
        school: school || null,
      };
      const res = await api.patch('/users/me', body);
      if (res.data) {
        setUser(prev => prev ? { ...prev, ...res.data } : res.data);
      }
      Alert.alert('Đã lưu', 'Hồ sơ đã được cập nhật');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể lưu thông tin');
    }
    setSaving(false);
  }

  function renderField(label, value, onPress, icon) {
    return (
      <>
        <Text style={styles.label}>{label}</Text>
        <TouchableOpacity style={styles.pickerBtn} onPress={onPress}>
          <View style={styles.pickerLeft}>
            {icon && <Ionicons name={icon} size={18} color="#6B7280" style={{ marginRight: 8 }} />}
            <Text style={[styles.pickerText, !value && styles.pickerPlaceholder]}>
              {value || `Chọn ${label.toLowerCase()}`}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
        </TouchableOpacity>
      </>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Chỉnh sửa hồ sơ</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.saveBtn}>Lưu</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
        {/* Avatar hint */}
        <Text style={styles.avatarHint}>
          Ảnh đại diện có thể thay đổi từ trang cá nhân
        </Text>

        {/* Name */}
        <Text style={styles.label}>Tên hiển thị</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Tên của bạn"
          placeholderTextColor="#9CA3AF"
          maxLength={100}
        />

        {/* Bio */}
        <Text style={styles.label}>Giới thiệu</Text>
        <TextInput
          style={[styles.input, styles.bioInput]}
          value={bio}
          onChangeText={setBio}
          placeholder="Vài dòng giới thiệu về bạn..."
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={500}
        />
        <Text style={styles.hint}>{bio.length}/500</Text>

        {/* Gender */}
        {renderField('Giới tính', gender, () => setPicker('gender'), 'male-female')}

        {/* Birth Year */}
        {renderField('Năm sinh', birthYear, () => setPicker('birth'), 'calendar-outline')}

        {/* Hometown */}
        {renderField('Quê quán', hometown, () => setPicker('hometown'), 'home-outline')}

        {/* Occupation */}
        {renderField('Nghề nghiệp', occupation, () => setPicker('occupation'), 'briefcase-outline')}

        {/* School */}
        {renderField('Trường học', school, () => setPicker('school'), 'school-outline')}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Pickers */}
      <PickerModal
        visible={picker === 'gender'}
        title="Chọn giới tính"
        data={GENDERS}
        value={gender}
        onSelect={setGender}
        onClose={() => setPicker(null)}
      />
      <PickerModal
        visible={picker === 'birth'}
        title="Chọn năm sinh"
        data={BIRTH_YEARS}
        value={birthYear}
        onSelect={setBirthYear}
        onClose={() => setPicker(null)}
      />
      <PickerModal
        visible={picker === 'hometown'}
        title="Chọn quê quán"
        data={PROVINCES}
        value={hometown}
        onSelect={setHometown}
        onClose={() => setPicker(null)}
      />
      <PickerModal
        visible={picker === 'occupation'}
        title="Chọn nghề nghiệp"
        data={OCCUPATIONS}
        value={occupation}
        onSelect={setOccupation}
        onClose={() => setPicker(null)}
      />
      <PickerModal
        visible={picker === 'school'}
        title="Chọn trường học"
        data={UNIVERSITIES}
        value={school}
        onSelect={setSchool}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

// ─── Styles ─────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB',
  },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: '700', color: '#000' },
  saveBtn: { fontSize: 16, fontWeight: '700', color: colors.primary },
  form: { flex: 1, padding: 20 },
  label: {
    fontSize: 13, fontWeight: '600', color: '#6B7280',
    marginBottom: 6, marginTop: 16, letterSpacing: 0.3,
  },
  input: {
    backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1,
    borderColor: '#E5E7EB', padding: 14, fontSize: 15, color: '#111827',
  },
  bioInput: { minHeight: 100, textAlignVertical: 'top', lineHeight: 20 },
  hint: { fontSize: 11, color: '#9CA3AF', textAlign: 'right', marginTop: 4 },
  avatarHint: {
    fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginBottom: 4,
  },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1,
    borderColor: '#E5E7EB', padding: 14,
  },
  pickerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  pickerText: { fontSize: 15, color: '#111827' },
  pickerPlaceholder: { color: '#9CA3AF' },
});

// ─── Modal Styles ───────────────────────────
const sModal = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '70%', paddingBottom: 30,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB',
  },
  title: { fontSize: 17, fontWeight: '700', color: '#111827' },
  item: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 20,
    borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6',
  },
  itemActive: { backgroundColor: '#F0F9FF' },
  itemText: { fontSize: 15, color: '#374151' },
  itemTextActive: { color: colors.primary, fontWeight: '600' },
});