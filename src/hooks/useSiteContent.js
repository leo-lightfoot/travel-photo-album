import { useEffect, useState } from 'react';

export const useSiteContent = () => {
  const [content, setContent] = useState(null);
  const [loadState, setLoadState] = useState('loading'); // 'loading' | 'ready' | 'error'

  useEffect(() => {
    fetch('/content.json')
      .then(res => {
        if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
        return res.json();
      })
      .then(data => {
        setContent(data);
        setLoadState('ready');
      })
      .catch(err => {
        console.error('Failed to load site content:', err);
        setLoadState('error');
      });
  }, []);

  return { content, loadState };
};
