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

const LoginScreen = ({navigation}) => {
  const {login} = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userType, setUserType] = useState('barbershop'); // 'admin', 'barbershop', 'barber'
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
    // Si es exitoso, el AuthContext manejará la navegación automática
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Barbería Manager</Text>
          <Text style={styles.subtitle}>Inicia sesión para continuar</Text>
        </View>

        <View style={styles.form}>
          {/* Selector de tipo de usuario */}
          <View style={styles.userTypeContainer}>
            <TouchableOpacity
              style={[
                styles.userTypeButton,
                userType === 'admin' && styles.userTypeButtonActive,
              ]}
              onPress={() => setUserType('admin')}>
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
              onPress={() => setUserType('barbershop')}>
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
              onPress={() => setUserType('barber')}>
              <Text
                style={[
                  styles.userTypeText,
                  userType === 'barber' && styles.userTypeTextActive,
                ]}>
                Barbero
              </Text>
            </TouchableOpacity>
          </View>

          {/* Campo de email */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="tu@email.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
          </View>

          {/* Campo de contraseña */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />
          </View>

          {/* Botón de login */}
          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Iniciar Sesión</Text>
            )}
          </TouchableOpacity>

          {/* Link para registro (solo para barberías) */}
          {userType === 'barbershop' && (
            <TouchableOpacity
              style={styles.registerLink}
              onPress={() => navigation.navigate('Register')}
              disabled={loading}>
              <Text style={styles.registerLinkText}>
                ¿No tienes cuenta? Regístrate aquí
              </Text>
            </TouchableOpacity>
          )}
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
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
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
  userTypeContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  userTypeButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  userTypeButtonActive: {
    backgroundColor: '#007AFF',
  },
  userTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  userTypeTextActive: {
    color: '#fff',
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
  loginButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  registerLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  registerLinkText: {
    color: '#007AFF',
    fontSize: 14,
  },
});

export default LoginScreen;
