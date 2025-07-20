import Head from "next/head";
import Link from "next/link";
import Script from "next/script";
import VoiceClient from "components/VoiceClient";

export default function Index() {
  const element = (
    <>
      <Head>
        <title>Video Monitoring Console</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <VoiceClient />
    </>
  );

  return element;
}
