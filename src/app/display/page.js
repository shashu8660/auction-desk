"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export default function DisplayPage() {
  const [auction, setAuction] = useState(null)
  const [player, setPlayer] = useState(null)
  const [lastSoldPlayer, setLastSoldPlayer] = useState(null)
  const [lastSoldTeam, setLastSoldTeam] = useState(null)
  const [teams, setTeams] = useState([])
  const [allPlayers, setAllPlayers] = useState([])
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [teamSquad, setTeamSquad] = useState([])

  const SQUAD_LIMIT = 10

  const fetchData = async () => {
    const { data: auctionData } = await supabase
      .from("auction_state")
      .select("*")
      .single()

    setAuction(auctionData)

    if (auctionData?.current_player) {
      const { data: playerData } = await supabase
        .from("players")
        .select("*")
        .eq("id", auctionData.current_player)
        .single()

      setPlayer(playerData)
    } else {
      setPlayer(null)
      // If auction idle and no current player, fetch last sold player
      const { data: lastSold } = await supabase
        .from("players")
        .select("*")
        .in("status", ["sold", "retained"])
        .order("updated_at", { ascending: false })
        .limit(1)

      if (lastSold && lastSold.length > 0) {
        const soldPlayer = lastSold[0]
        setLastSoldPlayer(soldPlayer)

        if (soldPlayer.team_id) {
          const { data: teamData } = await supabase
            .from("teams")
            .select("*")
            .eq("id", soldPlayer.team_id)
            .single()

          setLastSoldTeam(teamData)
        } else {
          setLastSoldTeam(null)
        }
      } else {
        setLastSoldPlayer(null)
        setLastSoldTeam(null)
      }
    }

    const { data: teamsData } = await supabase
      .from("teams_with_purse")
      .select("*")

    setTeams(teamsData || [])

    const { data: playersList } = await supabase
      .from("players")
      .select("*")
      .order("name", { ascending: true })

    setAllPlayers(playersList || [])
  }

  const fetchTeamSquad = async (teamId) => {
    const { data } = await supabase
      .from("players")
      .select("*")
      .eq("team_id", teamId)
      .in("status", ["sold", "retained"])
      .order("name", { ascending: true })

    setTeamSquad(data || [])
  }

  useEffect(() => {
    fetchData()

    const channel = supabase
      .channel("auction-display")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "auction_state" },
        fetchData
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        fetchData
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players" },
        fetchData
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const highestTeam =
    teams.find((t) => String(t.id) === String(auction?.highest_team)) ||
    teams.find((t) => String(t.id) === String(lastSoldPlayer?.team_id))

  // Helper to get player status color
  const getPlayerStatusColor = (status) => {
    if (status === "sold") return "text-green-400"
    if (status === "retained") return "text-yellow-400"
    if (status === "unsold") return "text-red-400"
    return "text-blue-400"
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-10">
      <h1 className="text-4xl md:text-6xl font-extrabold text-center mb-10 tracking-wide">
        🏆 LIVE AUCTION
      </h1>

      {auction && (
        <div className="space-y-12">

          {/* Current Player */}
          {(player || lastSoldPlayer) && (
            <div className="text-center">
              {(player || lastSoldPlayer).image && (
                <div className="flex justify-center mb-6">
                  <img
                    src={(player || lastSoldPlayer).image}
                    alt={(player || lastSoldPlayer).name}
                    className="h-40 w-auto object-contain rounded-xl"
                  />
                </div>
              )}
              <h2 className="text-5xl font-bold mt-2">
                {(player || lastSoldPlayer).name}
              </h2>
              <p className="text-2xl text-gray-300 mt-4">
                Base Price: ₹{(player || lastSoldPlayer).base_price}
              </p>
            </div>
          )}

          {/* Current Bid */}
          <div className="text-center">
            <h3 className="text-4xl md:text-6xl font-bold text-green-400">
              ₹{auction.current_bid}
            </h3>

            {highestTeam && (
              <div className="mt-6">
                <p className="text-2xl text-yellow-400 font-semibold">
                  Highest Bid By
                </p>
                <div className="flex justify-center items-center gap-4 mt-4">
                  {highestTeam.logo_url && (
                    <img
                      src={highestTeam.logo_url}
                      alt={highestTeam.name}
                      className="w-16 h-16 object-contain rounded-full bg-white p-1"
                    />
                  )}
                  <div>
                    <p className="text-4xl font-bold">
                      {highestTeam.name}
                    </p>
                    <p className="text-lg text-gray-300">
                      Owner: {highestTeam.owner_name}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {auction.status === "idle" && (player || lastSoldPlayer) && (
              <div className="mt-6">
                <p className="text-4xl font-bold text-red-500">
                  SOLD TO {(lastSoldTeam?.name || highestTeam?.name) || "-"}
                </p>

                {(lastSoldPlayer?.sold_price || player?.sold_price) && (
                  <p className="text-3xl font-bold text-green-400 mt-3">
                    SOLD FOR ₹{(lastSoldPlayer?.sold_price || player?.sold_price)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Teams */}
          <div>
            <h2 className="text-4xl font-bold text-center mb-10">
              Teams & Remaining Purse
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-10">
              {teams.map((team) => {
                const isHighest =
                  String(team.id) === String(auction?.highest_team)

                return (
                  <div
                    key={team.id}
                    onClick={() => {
                      if (selectedTeam?.id === team.id) {
                        // If same team clicked again, close it
                        setSelectedTeam(null)
                        setTeamSquad([])
                      } else {
                        // Open selected team
                        setSelectedTeam(team)
                        fetchTeamSquad(team.id)
                      }
                    }}
                    className={`cursor-pointer rounded-2xl p-6 border transition-all duration-300 ${
                      isHighest
                        ? "bg-yellow-500 text-black border-yellow-400 scale-105"
                        : "bg-gray-900 border-gray-700"
                    }`}
                  >
                    <div className="flex items-center gap-4 mb-4">
                      {team.logo_url && (
                        <img
                          src={team.logo_url}
                          alt={team.name}
                          className="w-16 h-16 object-contain rounded-full bg-white p-1"
                        />
                      )}

                      <div>
                        <p className="text-xl font-bold">
                          {team.name}
                        </p>
                        <p className="text-sm opacity-80">
                          {team.owner_name}
                        </p>
                      </div>
                    </div>

                    {team.owner_photo_url && (
                      <div className="flex justify-center mb-4">
                        <img
                          src={team.owner_photo_url}
                          alt={team.owner_name}
                          className="w-20 h-20 rounded-full object-cover border-2 border-yellow-400"
                        />
                      </div>
                    )}

                    <p className="text-2xl font-bold">
                      ₹{team.purse_remaining}
                    </p>
                    <p className="text-sm opacity-70">
                      Remaining Purse
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Selected Team Squad */}
          {selectedTeam && (
            <div className="mt-16 bg-gray-900 p-8 rounded-2xl">
              <h2 className="text-3xl font-bold mb-6">
                {selectedTeam.name} Squad
              </h2>

              <p className="text-yellow-400 mb-2">
                Squad Count: {teamSquad.length}
              </p>

              <p className="text-green-400 mb-6">
                Remaining Slots: {SQUAD_LIMIT - teamSquad.length}
              </p>

              {teamSquad.length === 0 ? (
                <p className="text-gray-400">No players yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {teamSquad.map((p) => (
                    <div
                      key={p.id}
                      className={`bg-gray-800 p-4 rounded-xl text-center ${
                        player?.id === p.id
                          ? "border-2 border-yellow-400"
                          : "border border-gray-700"
                      }`}
                    >
                      {p.image && (
                        <img
                          src={p.image}
                          alt={p.name}
                          className="h-24 mx-auto mb-3 object-contain"
                        />
                      )}

                      <p className="font-semibold">{p.name}</p>
                      <p className="text-sm text-gray-400">₹{p.sold_price}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        {/* All Players List */}
        <div className="mt-20">
          <h2 className="text-4xl font-bold text-center mb-10">
            📋 All Players & Status
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {allPlayers.map((p) => (
              <div
                key={p.id}
                className="bg-gray-900 border border-gray-700 rounded-xl p-5 text-center"
              >
                {p.image && (
                  <img
                    src={p.image}
                    alt={p.name}
                    className="h-24 mx-auto mb-4 object-contain"
                  />
                )}

                <p className="text-lg font-semibold">
                  {p.name}
                </p>

                <p className="text-sm text-gray-400">
                  Role: {p.role}
                </p>

                <p className="text-sm text-gray-400">
                  Base: ₹{p.base_price}
                </p>

                <p className={`mt-3 font-semibold ${getPlayerStatusColor(p.status)}`}>
                  {p.status.toUpperCase()}
                </p>

                {p.status === "sold" && p.team_id && (
                  <p className="text-green-400 text-sm mt-1">
                    Sold Price: ₹{p.sold_price}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    )}
  </div>
)
}