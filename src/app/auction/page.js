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
      .select("team_ids")
      .eq("id", userData.user.id)
      .single()

    if (!profile?.team_ids || profile.team_ids.length === 0) {
      router.push("/login")
      return
    }

    // Team info (auto purse view)
    const { data: teamData } = await supabase
      .from("teams_with_purse")
      .select("*")
      .in("id", profile.team_ids)

    setTeam(teamData || [])

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
      .in("team_id", profile.team_ids)
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

      // Auction state realtime (MAIN FIX)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "auction_state" },
        async (payload) => {
          const newState = payload.new
          setAuction(newState)

          // update highest team name instantly
          if (newState?.highest_team) {
            const { data: highestTeam } = await supabase
              .from("teams")
              .select("name")
              .eq("id", newState.highest_team)
              .single()

            setHighestTeamName(highestTeam?.name || null)
          } else {
            setHighestTeamName(null)
          }

          // update current player if changed
          if (newState?.current_player) {
            const { data: playerData } = await supabase
              .from("players")
              .select("*")
              .eq("id", newState.current_player)
              .single()

            setPlayer(playerData)
          } else {
            setPlayer(null)
          }
        }
      )

      // Players realtime
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "players" },
        (payload) => {
          setPlayer(prev =>
            prev?.id === payload.new.id ? { ...prev, ...payload.new } : prev
          )
        }
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

  const placeBidForTeam = async (teamObj, increment) => {
    if (!auction) return

    if (auction.status !== "running") {
      alert("Auction is not running")
      return
    }

    const currentBid = auction.current_bid || 0
    const newBid = currentBid + increment

    if (newBid > teamObj.purse_remaining) {
      alert("Insufficient purse")
      return
    }

    const { error } = await supabase.rpc("place_bid", {
      bid_amount: parseInt(newBid),
      team_id: teamObj.id
    })

    if (error) {
      alert(error.message)
    }
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-black text-white">
        Loading Auction...
      </div>
    )
  }

  const isHighestBidder = team?.some(t => t.id === auction?.highest_team)

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-10">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-bold">Teams Panel</h1>
          <p className="text-green-400 font-semibold">
            {team?.map(t => `${t.name}: ₹${t.purse_remaining}`).join(" | ")}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            {team?.map(t => {
              const isLeading = auction?.highest_team === t.id

              return (
                <div
                  key={t.id}
                  className={`p-6 rounded-2xl text-center border-2 transition-all duration-300 ${
                    isLeading
                      ? "border-yellow-400 bg-yellow-500/10 shadow-[0_0_20px_rgba(255,215,0,0.6)]"
                      : "border-gray-700 bg-gray-800"
                  }`}
                >
                  <p className="text-xl font-bold mb-3">{t.name}</p>

                  {isLeading && (
                    <p className="text-yellow-400 font-semibold mb-2">
                      🔥 Currently Bidding
                    </p>
                  )}

                  <div className="flex justify-center gap-4 mt-4">
                    <button
                      onClick={() => placeBidForTeam(t, 500)}
                      disabled={auction?.highest_team === t.id}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-5 py-2 rounded-lg font-bold"
                    >
                      +500
                    </button>

                    <button
                      onClick={() => placeBidForTeam(t, 1000)}
                      disabled={auction?.highest_team === t.id}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-5 py-2 rounded-lg font-bold"
                    >
                      +1000
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}