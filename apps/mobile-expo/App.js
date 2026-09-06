import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/contexts/AuthContext";
import { SocketProvider } from "./src/contexts/SocketContext";
import AppNavigator from "./src/navigation/AppNavigator";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StyleSheet } from "react-native";

export default function App() {
  return (
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
      <SafeAreaProvider>
        <AuthProvider>
          <SocketProvider>
            <AppNavigator />
            <StatusBar style="auto" />
          </SocketProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}