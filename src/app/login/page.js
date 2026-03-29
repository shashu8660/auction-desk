"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

export default function TeamLoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState("")

  const handleLogin = async (e) => {
    e.preventDefault()

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
      return
    }

    // Verify team role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, team_ids")
      .eq("id", data.user.id)
      .single()

    if (!profile || profile.role !== "team") {
      setMessage("Not authorized as team")
      await supabase.auth.signOut()
      return
    }

    // store team ids for auction page
    localStorage.setItem("team_ids", JSON.stringify(profile.team_ids || []))

    router.push("/auction")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="bg-gray-900 border border-gray-700 shadow-2xl p-10 rounded-2xl w-96">

        <h1 className="text-3xl font-bold mb-8 text-center tracking-wide">
          👥 Team Login
        </h1>

        <form onSubmit={handleLogin} className="space-y-5">

          <input
            type="email"
            placeholder="Team Email"
            className="w-full bg-gray-800 border border-gray-700 p-3 rounded-lg focus:outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password"
            className="w-full bg-gray-800 border border-gray-700 p-3 rounded-lg focus:outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 transition py-3 rounded-lg font-semibold text-lg"
          >
            Login
          </button>
        </form>

        {message && (
          <p className="mt-6 text-red-400 text-sm text-center">
            {message}
          </p>
        )}

      </div>
    </div>
  )
}