import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {useAuth} from '../../contexts/AuthContext';

const RegisterScreen = ({navigation}) => {
  const {register} = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    address: '',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (field, value) => {
    setFormData(prev => ({...prev, [field]: value}));
  };

  const handleRegister = async () => {
    // Validaciones
    if (!formData.name || !formData.email || !formData.password || !formData.phone) {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }

    if (formData.password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);
    const result = await register(formData);
    setLoading(false);

    if (result.success) {
      Alert.alert(
        'Registro Exitoso',
        'Tu cuenta ha sido creada. Ahora puedes iniciar sesión.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Login'),
          },
        ],
      );
    } else {
      Alert.alert('Error', result.message || 'Error al registrar');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Registrar Barbería</Text>
          <Text style={styles.subtitle}>Completa el formulario para comenzar</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Nombre de la Barbería *</Text>
            <TextInput
              style={styles.input}
              placeholder="Mi Barbería"
              value={formData.name}
              onChangeText={value => handleChange('name', value)}
              editable={!loading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email *</Text>
            <TextInput
              style={styles.input}
              placeholder="barberia@email.com"
              value={formData.email}
              onChangeText={value => handleChange('email', value)}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Teléfono *</Text>
            <TextInput
              style={styles.input}
              placeholder="+1234567890"
              value={formData.phone}
              onChangeText={value => handleChange('phone', value)}
              keyboardType="phone-pad"
              editable={!loading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Dirección</Text>
            <TextInput
              style={styles.input}
              placeholder="Calle Principal 123"
              value={formData.address}
              onChangeText={value => handleChange('address', value)}
              editable={!loading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Contraseña *</Text>
            <TextInput
              style={styles.input}
              placeholder="Mínimo 6 caracteres"
              value={formData.password}
              onChangeText={value => handleChange('password', value)}
              secureTextEntry
              editable={!loading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirmar Contraseña *</Text>
            <TextInput
              style={styles.input}
              placeholder="Repite tu contraseña"
              value={formData.confirmPassword}
              onChangeText={value => handleChange('confirmPassword', value)}
              secureTextEntry
              editable={!loading}
            />
          </View>

          <TouchableOpacity
            style={[styles.registerButton, loading && styles.registerButtonDisabled]}
            onPress={handleRegister}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.registerButtonText}>Registrar</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => navigation.navigate('Login')}
            disabled={loading}>
            <Text style={styles.loginLinkText}>
              ¿Ya tienes cuenta? Inicia sesión
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  registerButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loginLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  loginLinkText: {
    color: '#007AFF',
    fontSize: 14,
  },
});

export default RegisterScreen;
