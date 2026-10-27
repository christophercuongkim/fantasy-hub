import { redirect } from "next/navigation";

// Decision 7A: authenticated home is no longer a NavCard launcher.
export default function Home() {
  redirect("/hall_of_records");
}
