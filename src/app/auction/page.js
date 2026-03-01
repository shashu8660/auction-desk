"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

export default function AuctionPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [auction, setAuction] = useState(null)
  const [player, setPlayer] = useState(null)
  const [team, setTeam] = useState(null)
  const [teamPlayers, setTeamPlayers] = useState([])
  const [auctionHistory, setAuctionHistory] = useState([])
  const [highestTeamName, setHighestTeamName] = useState(null)

  const fetchData = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      router.push("/login")
      return
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("team_id")
      .eq("id", userData.user.id)
      .single()

    if (!profile?.team_id) {
      router.push("/login")
      return
    }

    // Team info (auto purse view)
    const { data: teamData } = await supabase
      .from("teams_with_purse")
      .select("*")
      .eq("id", profile.team_id)
      .single()

    setTeam(teamData)

    // Auction state
    const { data: auctionData } = await supabase
      .from("auction_state")
      .select("*")
      .single()

    setAuction(auctionData)

    if (auctionData?.highest_team) {
      const { data: highestTeam } = await supabase
        .from("teams")
        .select("name")
        .eq("id", auctionData.highest_team)
        .single()

      setHighestTeamName(highestTeam?.name || null)
    } else {
      setHighestTeamName(null)
    }

    // Current player
    if (auctionData?.current_player) {
      const { data: playerData } = await supabase
        .from("players")
        .select("*")
        .eq("id", auctionData.current_player)
        .single()

      setPlayer(playerData)
    } else {
      setPlayer(null)
    }

    // Team squad
    const { data: squad } = await supabase
      .from("players")
      .select("*")
      .eq("team_id", profile.team_id)
      .in("status", ["sold", "retained"])
      .order("name", { ascending: true })

    setTeamPlayers(squad || [])

    // Auction History (latest 20)
    const { data: history } = await supabase
      .from("auction_history")
      .select("player_name, team_name")
      .order("created_at", { ascending: false })
      .limit(20)

    setAuctionHistory(history || [])

    setLoading(false)
  }, [router])

  useEffect(() => {
    fetchData()

    const channel = supabase
      .channel("team-bid-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "auction_state" },
        () => fetchData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players" },
        () => fetchData()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "auction_history" },
        () => fetchData()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchData])

  const placeBid = async (increment) => {
    if (!auction || !team) return

    if (auction.status !== "running") {
      alert("Auction is not running")
      return
    }

    const currentBid = auction.current_bid || 0
    const newBid = currentBid + increment

    if (newBid > team.purse_remaining) {
      alert("Insufficient purse")
      return
    }

    const { error } = await supabase.rpc("place_bid", {
      bid_amount: parseInt(newBid)
    })

    if (error) {
      alert(error.message)
      return
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-black text-white">
        Loading Auction...
      </div>
    )
  }

  const isHighestBidder = auction?.highest_team === team?.id

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-10">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-bold">{team?.name}</h1>
          <p className="text-green-400 font-semibold">
            Purse Remaining: ₹{team?.purse_remaining}
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="bg-red-600 px-6 py-2 rounded-lg"
        >
          Logout
        </button>
      </div>

      {/* Current Player */}
      {player && (
        <div className="bg-gray-900 p-6 md:p-8 rounded-2xl text-center mb-10">
          {player.image && (
            <div className="flex justify-center mb-4">
              <img
                src={player.image}
                alt={player.name}
                className="h-40 w-auto object-contain rounded-xl"
              />
            </div>
          )}

          <p className="text-2xl font-bold">{player.name}</p>
          <p className="text-gray-400">Role: {player.role}</p>

          <p className="text-green-400 text-4xl mt-4">
            ₹{auction?.current_bid}
          </p>

          {highestTeamName && (
            <p className="text-yellow-400 mt-2 font-semibold">
              Highest Bidder: {highestTeamName}
            </p>
          )}

          {isHighestBidder && (
            <p className="text-yellow-400 font-bold mt-2">
              You are the highest bidder
            </p>
          )}

          {/* Bid Buttons */}
          {!isHighestBidder && (
            <div className="flex justify-center gap-4 mt-6 flex-wrap">
              {[100, 200, 500, 1000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => placeBid(amt)}
                  disabled={
                    auction.status !== "running" ||
                    auction.current_bid + amt > team.purse_remaining
                  }
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-6 py-2 rounded-lg"
                >
                  +₹{amt}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Team Squad */}
      <div className="bg-gray-900 p-8 rounded-2xl">
        <h2 className="text-2xl font-bold mb-4">
          Your Squad ({teamPlayers.length})
        </h2>

        {teamPlayers.length === 0 ? (
          <p className="text-gray-400">No players yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {teamPlayers.map((p) => (
              <div
                key={p.id}
                className="bg-gray-800 p-4 rounded-lg text-center"
              >
                {p.image && (
                  <img
                    src={p.image}
                    alt={p.name}
                    className="h-20 mx-auto mb-3 object-contain"
                  />
                )}
                <p className="font-semibold">{p.name}</p>
                <p className="text-sm text-gray-400">₹{p.sold_price}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Auction History */}
      <div className="bg-gray-900 p-8 rounded-2xl mt-10">
        <h2 className="text-2xl font-bold mb-4">
          Auction History
        </h2>

        {auctionHistory.length === 0 ? (
          <p className="text-gray-400">No completed sales yet.</p>
        ) : (
          <div className="space-y-3">
            {auctionHistory.map((item, index) => (
              <div
                key={index}
                className="bg-gray-800 p-3 rounded-lg flex flex-col sm:flex-row sm:justify-between gap-2"
              >
                <span className="font-semibold">
                  {item.player_name}
                </span>
                <span className="text-yellow-400">
                  {item.team_name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}