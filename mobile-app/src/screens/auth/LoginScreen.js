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
  Dimensions,
} from 'react-native';
import {useAuth} from '../../contexts/AuthContext';

const {width} = Dimensions.get('window');

const LoginScreen = ({navigation}) => {
  const {login} = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userType, setUserType] = useState('barbershop');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    setLoading(true);
    const result = await login({email, password}, userType);
    setLoading(false);

    if (!result.success) {
      Alert.alert('Error', result.message || 'Credenciales incorrectas');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header con Logo */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logo}>B</Text>
          </View>
          <Text style={styles.appName}>Barbershop Manager</Text>
          <Text style={styles.website}>mibarberiaweb.com</Text>
          <Text style={styles.tagline}>Sistema de Gestión Profesional</Text>
        </View>

        {/* Form Card */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Iniciar Sesión</Text>

          {/* Selector de tipo de usuario */}
          <View style={styles.userTypeContainer}>
            <TouchableOpacity
              style={[
                styles.userTypeButton,
                userType === 'admin' && styles.userTypeButtonActive,
              ]}
              onPress={() => setUserType('admin')}
              disabled={loading}>
              <Text
                style={[
                  styles.userTypeIcon,
                  userType === 'admin' && styles.userTypeIconActive,
                ]}>
                ⚙
              </Text>
              <Text
                style={[
                  styles.userTypeText,
                  userType === 'admin' && styles.userTypeTextActive,
                ]}>
                Admin
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.userTypeButton,
                userType === 'barbershop' && styles.userTypeButtonActive,
              ]}
              onPress={() => setUserType('barbershop')}
              disabled={loading}>
              <Text
                style={[
                  styles.userTypeIcon,
                  userType === 'barbershop' && styles.userTypeIconActive,
                ]}>
                🏪
              </Text>
              <Text
                style={[
                  styles.userTypeText,
                  userType === 'barbershop' && styles.userTypeTextActive,
                ]}>
                Barbería
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.userTypeButton,
                userType === 'barber' && styles.userTypeButtonActive,
              ]}
              onPress={() => setUserType('barber')}
              disabled={loading}>
              <Text
                style={[
                  styles.userTypeIcon,
                  userType === 'barber' && styles.userTypeIconActive,
                ]}>
                ✂
              </Text>
              <Text
                style={[
                  styles.userTypeText,
                  userType === 'barber' && styles.userTypeTextActive,
                ]}>
                Barbero
              </Text>
            </TouchableOpacity>
          </View>

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>📧 Email</Text>
            <TextInput
              style={styles.input}
              placeholder="tu@email.com"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>🔒 Contraseña</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />
          </View>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.loginButtonText}>
                Iniciar Sesión →
              </Text>
            )}
          </TouchableOpacity>

          {/* Register Link */}
          {userType === 'barbershop' && (
            <TouchableOpacity
              style={styles.registerLink}
              onPress={() => navigation.navigate('Register')}
              disabled={loading}>
              <Text style={styles.registerLinkText}>
                ¿No tienes cuenta? <Text style={styles.registerLinkBold}>Regístrate aquí</Text>
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Sistema de gestión para barberías profesionales
          </Text>
          <Text style={styles.footerWebsite}>www.mibarberiaweb.com</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
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
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#2c3e50',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#2c3e50',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logo: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#fff',
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  website: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3498db',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 14,
    color: '#7f8c8d',
    fontStyle: 'italic',
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
    textAlign: 'center',
  },
  userTypeContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    justifyContent: 'space-between',
  },
  userTypeButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e9ecef',
    marginHorizontal: 4,
  },
  userTypeButtonActive: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  userTypeIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  userTypeIconActive: {
    fontSize: 28,
  },
  userTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#495057',
  },
  userTypeTextActive: {
    color: '#fff',
  },
  inputContainer: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
    color: '#2c3e50',
  },
  loginButton: {
    backgroundColor: '#2c3e50',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#2c3e50',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  registerLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  registerLinkText: {
    color: '#6c757d',
    fontSize: 14,
  },
  registerLinkBold: {
    color: '#3498db',
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 4,
  },
  footerWebsite: {
    fontSize: 13,
    color: '#3498db',
    fontWeight: '600',
  },
});

export default LoginScreen;
