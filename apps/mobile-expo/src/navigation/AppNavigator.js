import React from "react";
import { View, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import ChatListScreen from "../screens/ChatListScreen";
import ChatDetailScreen from "../screens/ChatDetailScreen";
import FeedScreen from "../screens/FeedScreen";
import SOSScreen from "../screens/SOSScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import { useAuth } from "../contexts/AuthContext";
import { colors } from "../theme/colors";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function HomeTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let name;
          if (route.name === "Chat") name = focused ? "chatbubbles" : "chatbubbles-outline";
          else if (route.name === "Feed") name = focused ? "compass" : "compass-outline";
          else if (route.name === "SOS") name = focused ? "alert-circle" : "alert-circle-outline";
          else if (route.name === "Notifications") name = focused ? "notifications" : "notifications-outline";
          else if (route.name === "Profile") name = focused ? "person" : "person-outline";
          return <Ionicons name={name} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: "#8A8D91",
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: "#E5E5E5",
          borderTopWidth: 0.5,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500" },
      })}
    >
      <Tab.Screen name="Chat" component={ChatListScreen} />
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen
        name="SOS"
        component={SOSScreen}
        options={{
          tabBarLabel: "SOS",
          tabBarIcon: ({ focused, color }) => (
            <View style={styles.sosTabIcon}>
              <Ionicons
                name={focused ? "alert-circle" : "alert-circle-outline"}
                size={28}
                color={focused ? "#EF4444" : "#8A8D91"}
              />
            </View>
          ),
        }}
      />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Home" component={HomeTabs} />
            <Stack.Screen
              name="ChatDetail"
              component={ChatDetailScreen}
              options={{ headerShown: false, animation: "slide_from_right" }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  sosTabIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -8,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
});