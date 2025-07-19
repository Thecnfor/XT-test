'use client'
import { useEffect } from "react";
import '@/styles/globals.scss'

export default function Text({ text }: { text: string }) {
  useEffect(() => {

    return () => {
    };
  }, []);
  return (
    <span>
      {text}
    </span>
  );
}