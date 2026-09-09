import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useBadge } from "../contexts/BadgeContext";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen";
import ChatListScreen from "../screens/ChatListScreen";
import ChatDetailScreen from "../screens/ChatDetailScreen";
import FeedScreen from "../screens/FeedScreen";
import SOSScreen from "../screens/SOSScreen";
import ExploreScreen from "../screens/ExploreScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import EditProfileScreen from "../screens/EditProfileScreen";
import ChangePasswordScreen from "../screens/ChangePasswordScreen";
import BlockedUsersScreen from "../screens/BlockedUsersScreen";
import SOSHelperSetupScreen from "../screens/SOSHelperSetupScreen";
import NotificationSettingsScreen from "../screens/NotificationSettingsScreen";
import PrivacySettingsScreen from "../screens/PrivacySettingsScreen";
import MyPostsScreen from "../screens/MyPostsScreen";
import PostDetailScreen from "../screens/PostDetailScreen";
import { useAuth } from "../contexts/AuthContext";
import { colors } from "../theme/colors";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function HomeTabs() {
  const { messageUnread, notificationUnread, sosUnread } = useBadge();

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
      <Tab.Screen
        name="Chat"
        component={ChatListScreen}
        options={{ tabBarBadge: messageUnread > 0 ? (messageUnread > 99 ? "99+" : messageUnread) : undefined }}
      />
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen
        name="SOS"
        component={SOSScreen}
        options={{
          tabBarLabel: "SOS",
          tabBarBadge: sosUnread > 0 ? (sosUnread > 99 ? "99+" : sosUnread) : undefined,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? "alert-circle" : "alert-circle-outline"}
              size={26}
              color={focused ? "#EF4444" : "#8A8D91"}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ tabBarBadge: notificationUnread > 0 ? (notificationUnread > 99 ? "99+" : notificationUnread) : undefined }}
      />
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
            <Stack.Screen name="ChatDetail" component={ChatDetailScreen} options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="Explore" component={ExploreScreen} options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="SOSHelperSetup" component={SOSHelperSetupScreen} options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="PrivacySettings" component={PrivacySettingsScreen} options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="MyPosts" component={MyPostsScreen} options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ animation: "slide_from_right" }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}