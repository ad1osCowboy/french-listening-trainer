import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../screens/HomeScreen';
import SegmentsScreen from '../screens/SegmentsScreen';
import SentencesScreen from '../screens/SentencesScreen';
import PassageScreen from '../screens/PassageScreen';
import VocabularyScreen from '../screens/VocabularyScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: { backgroundColor: '#1a73e8' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '600' },
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'French Listening Trainer' }}
        />
        <Stack.Screen
          name="Segments"
          component={SegmentsScreen}
          options={{ title: '错题片段' }}
        />
        <Stack.Screen
          name="Sentences"
          component={SentencesScreen}
          options={{ title: '句子跟读' }}
        />
        <Stack.Screen
          name="Passage"
          component={PassageScreen}
          options={{ title: '整段跟读' }}
        />
        <Stack.Screen
          name="Vocabulary"
          component={VocabularyScreen}
          options={{ title: '生词本' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
