import React, { useEffect } from 'react';
import { DevSandbox } from './features/language-engine/components/DevSandbox';
import { useBoundStore } from './store/useBoundStore';

function App() {
  const setProfile = useBoundStore((state) => state.setProfile);

  // Initialize the global store with a valid baseline user account context object structure
  useEffect(() => {
    setProfile({
      id: 'usr_dev_test_01',
      username: 'Robin_Learner',
      accountLevel: 1,
      experiencePoints: 0,
      unlockedAbilities: [],
      createdAt: new Date().toISOString(),
    });
  }, [setProfile]);

  return (
    <>
      <DevSandbox />
    </>
  );
}

export default App;
