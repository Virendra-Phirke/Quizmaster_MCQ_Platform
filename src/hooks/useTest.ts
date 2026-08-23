import { useContext } from 'react';
import { TestContext } from '../contexts/TestContext';

export function useTest() {
  const context = useContext(TestContext);
  if (!context) {
    throw new Error('useTest must be used within a TestProvider');
  }
  return context;
}
