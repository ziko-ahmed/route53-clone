import { redirect } from "next/navigation";

/** Nothing lives at "/", so send people to the main page. */
export default function Home() {
  redirect("/hosted-zones");
}
