import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import api from '../../services/api';

const ProfileScreen = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  // Obtener contextos
  const getSafeContext = () => {
    try {
      const {useAuth} = require('../../contexts/AuthContext');
      const {useNavigation} = require('../../contexts/NavigationContext');

      const auth = useAuth();
      const nav = useNavigation();

      return {
        user: auth?.user,
        userType: auth?.userType,
        goBack: nav?.goBack || (() => console.log('GoBack')),
      };
    } catch (error) {
      console.error('Error getting context:', error);
      return {
        user: null,
        userType: null,
        goBack: () => console.log('GoBack'),
      };
    }
  };

  const {user, userType, goBack} = getSafeContext();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      let endpoint = '';
      if (userType === 'barbershop') {
        endpoint = `/api/barbershops/${user?.barbershop_id}`;
      } else if (userType === 'barber') {
        endpoint = `/api/barbers/${user?.barber_id}`;
      } else if (userType === 'admin' || userType === 'super_admin') {
        // For admin, use user data directly
        setProfile({
          name: user?.name,
          email: user?.email,
          role: userType,
        });
        setLoading(false);
        return;
      }

      const response = await api.get(endpoint);
      setProfile(response.data);
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'No se pudo cargar el perfil');
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    try {
      setSaving(true);
      let endpoint = '';
      if (userType === 'barbershop') {
        endpoint = `/api/barbershops/${user?.barbershop_id}`;
      } else if (userType === 'barber') {
        endpoint = `/api/barbers/${user?.barber_id}`;
      }

      await api.put(endpoint, profile);
      Alert.alert('Éxito', 'Perfil actualizado correctamente');
      setEditing(false);
      loadProfile();
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'No se pudo actualizar el perfil');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Cargando perfil...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Mi Perfil</Text>
        <TouchableOpacity
          onPress={() => (editing ? saveProfile() : setEditing(true))}
          style={styles.editButton}>
          <Text style={styles.editText}>{editing ? 'Guardar' : 'Editar'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile?.name?.charAt(0) || profile?.business_name?.charAt(0) || 'U'}
            </Text>
          </View>
          <Text style={styles.roleText}>
            {userType === 'barbershop'
              ? 'Barbería'
              : userType === 'barber'
              ? 'Barbero'
              : 'Administrador'}
          </Text>
        </View>

        {/* Form Fields */}
        <View style={styles.form}>
          {userType === 'barbershop' && (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Nombre del Negocio</Text>
                <TextInput
                  style={[styles.input, !editing && styles.inputDisabled]}
                  value={profile?.business_name || ''}
                  onChangeText={text =>
                    setProfile({...profile, business_name: text})
                  }
                  editable={editing}
                  placeholder="Nombre de la barbería"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Nombre del Propietario</Text>
                <TextInput
                  style={[styles.input, !editing && styles.inputDisabled]}
                  value={profile?.owner_name || ''}
                  onChangeText={text =>
                    setProfile({...profile, owner_name: text})
                  }
                  editable={editing}
                  placeholder="Nombre del propietario"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Dirección</Text>
                <TextInput
                  style={[styles.input, !editing && styles.inputDisabled]}
                  value={profile?.address || ''}
                  onChangeText={text => setProfile({...profile, address: text})}
                  editable={editing}
                  placeholder="Dirección"
                  multiline
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Teléfono</Text>
                <TextInput
                  style={[styles.input, !editing && styles.inputDisabled]}
                  value={profile?.phone || ''}
                  onChangeText={text => setProfile({...profile, phone: text})}
                  editable={editing}
                  placeholder="Teléfono"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>WhatsApp</Text>
                <TextInput
                  style={[styles.input, !editing && styles.inputDisabled]}
                  value={profile?.whatsapp_number || ''}
                  onChangeText={text =>
                    setProfile({...profile, whatsapp_number: text})
                  }
                  editable={editing}
                  placeholder="Número de WhatsApp"
                  keyboardType="phone-pad"
                />
              </View>
            </>
          )}

          {userType === 'barber' && (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Nombre</Text>
                <TextInput
                  style={[styles.input, !editing && styles.inputDisabled]}
                  value={profile?.name || ''}
                  onChangeText={text => setProfile({...profile, name: text})}
                  editable={editing}
                  placeholder="Nombre"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Teléfono</Text>
                <TextInput
                  style={[styles.input, !editing && styles.inputDisabled]}
                  value={profile?.phone || ''}
                  onChangeText={text => setProfile({...profile, phone: text})}
                  editable={editing}
                  placeholder="Teléfono"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Comisión (%)</Text>
                <TextInput
                  style={[styles.input, !editing && styles.inputDisabled]}
                  value={String(profile?.commission_percentage || 60)}
                  onChangeText={text =>
                    setProfile({
                      ...profile,
                      commission_percentage: parseFloat(text) || 60,
                    })
                  }
                  editable={editing}
                  placeholder="60"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Duración de servicio (minutos)</Text>
                <TextInput
                  style={[styles.input, !editing && styles.inputDisabled]}
                  value={String(profile?.service_duration_minutes || 30)}
                  onChangeText={text =>
                    setProfile({
                      ...profile,
                      service_duration_minutes: parseInt(text) || 30,
                    })
                  }
                  editable={editing}
                  placeholder="30"
                  keyboardType="numeric"
                />
              </View>
            </>
          )}

          {/* Common fields */}
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={profile?.email || user?.email || ''}
              editable={false}
              placeholder="email@example.com"
            />
          </View>

          {profile?.created_at && (
            <View style={styles.field}>
              <Text style={styles.label}>Fecha de registro</Text>
              <Text style={styles.infoText}>
                {new Date(profile.created_at).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>

        {editing && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setEditing(false);
                loadProfile();
              }}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={saveProfile}
              disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Guardar Cambios</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#7f8c8d',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 40,
    backgroundColor: '#2c3e50',
  },
  backButton: {
    padding: 8,
  },
  backIcon: {
    fontSize: 24,
    color: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  editButton: {
    padding: 8,
  },
  editText: {
    fontSize: 16,
    color: '#3498db',
    fontWeight: '600',
  },
  content: {
    padding: 16,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
  },
  roleText: {
    fontSize: 16,
    color: '#7f8c8d',
    fontWeight: '600',
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#2c3e50',
    backgroundColor: '#fff',
  },
  inputDisabled: {
    backgroundColor: '#ecf0f1',
    color: '#7f8c8d',
  },
  infoText: {
    fontSize: 16,
    color: '#7f8c8d',
    paddingVertical: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#95a5a6',
    marginRight: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#27ae60',
    marginLeft: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ProfileScreen;
