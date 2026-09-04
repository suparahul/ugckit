import { redirect } from "next/navigation";

/** The orb is the front door. */
export default function Home() {
  redirect("/orb");
}
