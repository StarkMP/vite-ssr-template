import { useState } from 'react';

import { Button } from '@/components/button';

export const App = () => {
  const [count, setCount] = useState(0);

  return (
    <main>
      <Button onClick={() => setCount((count) => count + 1)}>Count is {count}</Button>
    </main>
  );
};
