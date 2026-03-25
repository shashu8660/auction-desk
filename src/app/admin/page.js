"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

export default function AdminPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [players, setPlayers] = useState([])
  const [auction, setAuction] = useState(null)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showResetModal, setShowResetModal] = useState(false)
  const [teams, setTeams] = useState([])

  const [retainPlayerId, setRetainPlayerId] = useState(null)
  const [retainAmount, setRetainAmount] = useState("")
  const [retainTeamId, setRetainTeamId] = useState("")

  const [overrideBid, setOverrideBid] = useState("")
  const [overrideTeamId, setOverrideTeamId] = useState("")

  const [previewImage, setPreviewImage] = useState(null)

  // 🔐 Admin Check
  const checkAdmin = async () => {
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      router.push("/admin-login")
      return
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single()

    if (!profile || profile.role !== "admin") {
      router.push("/")
      return
    }

    setLoading(false)
  }

  const fetchData = useCallback(async () => {
    const { data: playersData } = await supabase
      .from("players")
      .select(`
        id,
        name,
        role,
        status,
        base_price,
        sold_price,
        team_id,
        image,
        player_number,
        is_retained,
        teams (
          name,
          owner_name
        )
      `)
      .order("name", { ascending: true })

    const { data: auctionData } = await supabase
      .from("auction_state")
      .select("*")
      .single()

    const { data: teamsData } = await supabase
      .from("teams")
      .select("id, name")
      .order("name", { ascending: true })

    setPlayers(playersData || [])

    let highestTeamName = null

    if (auctionData?.highest_team) {
      const { data: teamData } = await supabase
        .from("teams")
        .select("name")
        .eq("id", auctionData.highest_team)
        .single()

      highestTeamName = teamData?.name
    }

    setAuction({
      ...auctionData,
      highest_team_name: highestTeamName
    })
    setTeams(teamsData || [])
  }, [])

  useEffect(() => {
    checkAdmin()
  }, [])

  useEffect(() => {
    if (!loading) fetchData()
  }, [loading])

  useEffect(() => {
    if (loading) return

    fetchData()

    const channel = supabase
      .channel("admin-auction-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "auction_state"
        },
        () => fetchData()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players"
        },
        () => fetchData()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loading, fetchData])

  const startAuction = async () => {
    await supabase
      .from("auction_state")
      .update({ status: "running" })
      .eq("id", 1)

    fetchData()
  }

  const endAuction = async () => {
    await supabase
      .from("auction_state")
      .update({
        status: "idle",
        current_player: null,
        current_bid: 0,
        highest_team: null
      })
      .eq("id", 1)

    fetchData()
  }

  const setCurrentPlayer = async (playerId, basePrice) => {
    await supabase
      .from("auction_state")
      .update({
        current_player: playerId,
        current_bid: basePrice,
        highest_team: null,
        status: "running"
      })
      .eq("id", 1)

    fetchData()
  }

  const markSold = async () => {
    // Always fetch latest auction state from DB
    const { data: latestAuction } = await supabase
      .from("auction_state")
      .select("*")
      .eq("id", 1)
      .single()

    if (!latestAuction?.current_player) return

    if (!latestAuction?.highest_team) {
      // No bids → revert to available
      await supabase
        .from("players")
        .update({
          status: "available",
          sold_price: 0,
          team_id: null
        })
        .eq("id", latestAuction.current_player)

      await supabase
        .from("auction_state")
        .update({
          current_player: null,
          current_bid: 0,
          highest_team: null,
          status: "idle"
        })
        .eq("id", 1)

      fetchData()
      return
    }

    // If highest bidder exists → sell properly
    const { error } = await supabase.rpc("mark_player_sold")

    if (error) {
      alert(error.message)
    }

    fetchData()
  }

  const handleUndo = async () => {
    // 1. Get last sold player
    const { data: lastSold } = await supabase
      .from("players")
      .select("*")
      .eq("status", "sold")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single()

    if (!lastSold) {
      alert("No sold player to undo")
      return
    }

    // 2. Refund amount (atomic via RPC)
    if (lastSold.team_id && lastSold.sold_price) {
      const { error: refundError } = await supabase.rpc("refund_team_purse", {
        team_id_input: lastSold.team_id,
        amount_input: lastSold.sold_price
      })

      if (refundError) {
        alert(refundError.message)
        return
      }
    }

    // 4. Reset player
    await supabase
      .from("players")
      .update({
        status: "available",
        sold_price: null,
        team_id: null,
        team_name: null,
        owner_name: null
      })
      .eq("id", lastSold.id)

    alert("Last sold player reverted successfully")
    fetchData()
  }

  const handleFullReset = async () => {
    const { error } = await supabase.rpc("full_reset_auction")

    if (error) {
      alert(error.message)
    } else {
      alert("Auction fully reset successfully")
      fetchData()
    }

    setShowResetModal(false)
  }

  const submitRetained = async () => {
    if (!retainPlayerId || !retainAmount || !retainTeamId) {
      alert("Please select team and enter amount")
      return
    }

    const { error } = await supabase.rpc("mark_player_retained", {
      p_player_id: retainPlayerId,
      p_amount: Number(retainAmount),
      p_team_id: retainTeamId
    })

    if (error) {
      alert(error.message)
    } else {
      await supabase
        .from("players")
        .update({ is_retained: true })
        .eq("id", retainPlayerId)

      alert("Player marked as retained")
      setRetainPlayerId(null)
      setRetainAmount("")
      setRetainTeamId("")
      fetchData()
    }
  }

  const handleOverrideBid = async () => {
    if (!overrideBid || !overrideTeamId) {
      alert("Enter bid amount and select team")
      return
    }

    const { error } = await supabase.rpc("admin_override_bid", {
      p_bid: Number(overrideBid),
      p_team_id: overrideTeamId
    })

    if (error) {
      alert(error.message)
    } else {
      alert("Bid overridden successfully")
      setOverrideBid("")
      setOverrideTeamId("")
      fetchData()
    }
  }

  const filteredPlayers = players.filter((player) => {
    const matchesSearch =
      player.name.toLowerCase().includes(search.toLowerCase()) ||
      String(player.player_number || "").includes(search)

    const matchesRole =
      roleFilter === "all" || player.role === roleFilter

    const matchesStatus =
      statusFilter === "all" || player.status === statusFilter

    return matchesSearch && matchesRole && matchesStatus
  });

  const totalPlayers = players.length
  const availableCount = players.filter(p => p.status === "available").length
  const soldCount = players.filter(p => p.status === "sold").length
  const retainedCount = players.filter(p => p.status === "retained").length
  const unsoldCount = players.filter(p => p.status === "unsold").length

  const logout = async () => {
    await supabase.auth.signOut()
    router.push("/admin-login")
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-black text-white">
        Checking admin access...
      </div>
    )
  }

  // Log available teams for admin reference
  console.log("Available Teams for Retain:", teams)

  const currentPlayer = players.find(
    (p) => p.id === auction?.current_player
  )

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-10">

      <div className="flex justify-between mb-10">
        <h1 className="text-4xl font-bold">🛠 Admin Panel</h1>
        <button
          onClick={logout}
          className="bg-red-600 px-6 py-2 rounded-lg"
        >
          Logout
        </button>
      </div>

      {/* Auction Controls */}
      <div className="bg-gray-900 p-6 rounded-2xl mb-8">
        <p>Status: {auction?.status}</p>
        <p className="text-green-400 text-2xl mt-2">
          Current Bid: ₹{auction?.current_bid}
        </p>
        <p className="text-yellow-400 mt-2 text-lg">
          Highest Bidder: {auction?.highest_team_name || "None"}
        </p>

        {currentPlayer && (
          <div className="mt-4 flex items-center gap-4 bg-gray-800 p-4 rounded-xl">
            {currentPlayer.image && (
              <img
                src={currentPlayer.image}
                alt={currentPlayer.name}
                className="w-20 h-20 object-cover rounded-lg border border-gray-600"
              />
            )}

            <div>
              <p className="text-xl font-semibold">
                {currentPlayer.name}
              </p>
              <p className="text-gray-400 text-sm">
                Base Price: ₹{currentPlayer.base_price}
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-4 mt-6">
          <button
            onClick={startAuction}
            className="bg-blue-600 px-6 py-2 rounded-lg"
          >
            Start Auction
          </button>

          <button
            onClick={endAuction}
            className="bg-gray-700 px-6 py-2 rounded-lg"
          >
            END AUCTION
          </button>

          <button
            onClick={markSold}
            className="bg-green-600 px-6 py-2 rounded-lg"
          >
            SOLD
          </button>

          <button
            onClick={handleUndo}
            className="bg-red-700 px-6 py-2 rounded-lg"
          >
            UNDO LAST SOLD
          </button>

          <button
            onClick={() => setShowResetModal(true)}
            className="bg-red-900 px-6 py-2 rounded-lg"
          >
            FULL RESET AUCTION
          </button>
        </div>

        <div className="mt-6 bg-gray-800 p-4 rounded-xl w-full">
          <h3 className="text-lg font-semibold mb-3 text-yellow-400">
            Admin Bid Override
          </h3>

          <div className="grid md:grid-cols-3 gap-4">
            <input
              type="number"
              placeholder="Override Bid Amount"
              value={overrideBid}
              onChange={(e) => setOverrideBid(e.target.value)}
              className="bg-gray-700 p-2 rounded"
            />

            <select
              value={overrideTeamId}
              onChange={(e) => setOverrideTeamId(e.target.value)}
              className="bg-gray-700 p-2 rounded"
            >
              <option value="">Select Team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>

            <button
              onClick={handleOverrideBid}
              className="bg-yellow-600 px-4 py-2 rounded-lg"
            >
              Apply Override
            </button>
          </div>
        </div>
      </div>

      {/* Player Summary */}
      <div className="bg-gray-900 p-6 rounded-2xl mb-8 grid md:grid-cols-5 gap-6 text-center">
        <div>
          <p className="text-gray-400 text-sm">Total Players</p>
          <p className="text-2xl font-bold text-white">{totalPlayers}</p>
        </div>
        <div>
          <p className="text-gray-400 text-sm">Available</p>
          <p className="text-2xl font-bold text-blue-400">{availableCount}</p>
        </div>
        <div>
          <p className="text-gray-400 text-sm">Sold</p>
          <p className="text-2xl font-bold text-green-400">{soldCount}</p>
        </div>
        <div>
          <p className="text-gray-400 text-sm">Retained</p>
          <p className="text-2xl font-bold text-yellow-400">{retainedCount}</p>
        </div>
        <div>
          <p className="text-gray-400 text-sm">Unsold</p>
          <p className="text-2xl font-bold text-red-400">{unsoldCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-900 p-6 rounded-2xl mb-8 grid md:grid-cols-3 gap-6">
        <input
          type="text"
          placeholder="Search player..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-gray-800 border border-gray-600 p-3 rounded-lg"
        />

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="bg-gray-800 border border-gray-600 p-3 rounded-lg"
        >
          <option value="all">All Roles</option>
          <option value="Batsman">Batsman</option>
          <option value="Bowler">Bowler</option>
          <option value="Allrounder">Allrounder</option>
          <option value="WK">WK</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-gray-800 border border-gray-600 p-3 rounded-lg"
        >
          <option value="all">All Status</option>
          <option value="available">Available</option>
          <option value="retained">Retained</option>
          <option value="sold">Sold</option>
          <option value="unsold">Unsold</option>
        </select>
      </div>

      {/* Player List */}
      <div className="space-y-4">
        {filteredPlayers.map((player) => (
          <div
            key={player.id}
            className="bg-gray-900 border border-gray-700 p-6 rounded-xl flex flex-col md:flex-row md:justify-between md:items-center gap-4"
          >
            <div className="flex items-start gap-4">
              {player.image && (
                <img
                  src={player.image}
                  alt={player.name}
                  onClick={() => setPreviewImage(player.image)}
                  className="w-16 h-16 object-cover rounded-lg border border-gray-600 cursor-pointer hover:scale-105 transition"
                />
              )}

              <div>
                <p className="text-yellow-400 font-bold text-lg">
                  #{player.player_number ?? "N/A"}
                </p>
                <p className="text-lg font-semibold">
                  {player.name}
                </p>
                <p className="text-gray-400 text-sm">
                  Role: {player.role || "N/A"}
                </p>
                <p className="text-gray-400 text-sm">
                  Status: {player.status}
                </p>

                {player.status === "available" && (
                  <>
                    <button
                      onClick={() =>
                        setCurrentPlayer(player.id, player.base_price)
                      }
                      className="bg-purple-600 mt-3 px-4 py-1 rounded-lg"
                    >
                      Set As Current Player
                    </button>

                    <button
                      onClick={() => setRetainPlayerId(player.id)}
                      className="bg-yellow-600 mt-3 ml-3 px-4 py-1 rounded-lg"
                    >
                      Mark Retained
                    </button>

                    {retainPlayerId === player.id && (
                      <div className="mt-4 bg-gray-800 p-4 rounded-lg space-y-3">

                        <input
                          type="number"
                          placeholder="Retain Amount"
                          value={retainAmount}
                          onChange={(e) => setRetainAmount(e.target.value)}
                          className="bg-gray-700 p-2 rounded w-full"
                        />

                        <select
                          value={retainTeamId}
                          onChange={(e) => setRetainTeamId(e.target.value)}
                          className="bg-gray-700 p-2 rounded w-full"
                        >
                          <option value="">Select Team</option>
                          {teams.map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.name}
                            </option>
                          ))}
                        </select>

                        <div className="flex gap-3">
                          <button
                            onClick={submitRetained}
                            className="bg-green-600 px-4 py-1 rounded-lg"
                          >
                            Confirm
                          </button>

                          <button
                            onClick={() => {
                              setRetainPlayerId(null)
                              setRetainAmount("")
                              setRetainTeamId("")
                            }}
                            className="bg-gray-600 px-4 py-1 rounded-lg"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {player.team_id && (
                  <>
                    <p className="text-yellow-400 text-sm mt-1">
                      Sold To: {player.teams?.name}
                    </p>
                    <p className="text-gray-400 text-sm">
                      Owner: {player.teams?.owner_name}
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="text-right">
              <p className="text-green-400 font-bold">
                ₹{player.status === 'sold' || player.status === 'retained'
                  ? player.sold_price
                  : player.base_price}
              </p>
            </div>
          </div>
        ))}
      </div>

      {showResetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-gray-900 p-8 rounded-2xl border border-red-600 w-96 text-center">
            <h2 className="text-2xl font-bold text-red-500 mb-4">
              ⚠ Confirm Full Reset
            </h2>

            <p className="text-gray-300 mb-6">
              This will reset all SOLD players back to AVAILABLE.
              Retained players will NOT be affected.
            </p>

            <div className="flex justify-center gap-4">
              <button
                onClick={() => setShowResetModal(false)}
                className="bg-gray-700 px-6 py-2 rounded-lg"
              >
                Cancel
              </button>

              <button
                onClick={handleFullReset}
                className="bg-red-700 px-6 py-2 rounded-lg"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {previewImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50"
          onClick={() => setPreviewImage(null)}
        >
          <img
            src={previewImage}
            alt="Preview"
            className="max-h-[90vh] max-w-[90vw] rounded-xl shadow-2xl"
          />
        </div>
      )}

    </div>
  )
}