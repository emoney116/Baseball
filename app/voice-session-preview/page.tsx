import { notFound } from 'next/navigation';
import { VoiceSessionPreview } from './preview';
export const dynamic = 'force-dynamic';
export default function Page() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <VoiceSessionPreview typedEnabled={process.env.CLUBHOUSE_VOICE_V2_QA==='true'} />;
}
