"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export default function DisplayPage() {
  const [teams, setTeams] = useState([])
  const [activeTeamId, setActiveTeamId] = useState(null)
  const [view, setView] = useState("overview") // overview | players | teams
  const [players, setPlayers] = useState([])
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [fullscreenImage, setFullscreenImage] = useState(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  // 1) Add new state for auction
  const [auctionState, setAuctionState] = useState(null)
  const [lastBid, setLastBid] = useState(0)
  const [bidFlash, setBidFlash] = useState(false)

  const fetchTeams = async () => {
    const { data } = await supabase.from("teams").select("*")
    setTeams(data || [])
  }

  const fetchPlayers = async () => {
    const { data } = await supabase
      .from("players")
      .select("*")
    setPlayers(data || [])
  }

  // 2) Add fetchAuctionState function below fetchPlayers
  const fetchAuctionState = async () => {
    const { data } = await supabase
      .from("auction_state")
      .select("*")
      .eq("id", 1)
      .maybeSingle()

    setAuctionState(data)

    // Animation for bid increase
    if (data?.current_bid && data.current_bid > lastBid) {
      setBidFlash(true)
      setTimeout(() => setBidFlash(false), 600)
    }
    setLastBid(data?.current_bid || 0)

    if (data?.highest_team) {
      setActiveTeamId(data.highest_team)
    }
  }

  useEffect(() => {
    fetchTeams()
    fetchPlayers()
    // 3) In useEffect, after fetchPlayers():
    fetchAuctionState()

    const channel = supabase
      .channel("auction-realtime")

      // TEAMS
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        (payload) => {
          setTeams(prev =>
            prev.map(t =>
              t.id === payload.new.id ? { ...t, ...payload.new } : t
            )
          )
        }
      )

      // PLAYERS
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players" },
        (payload) => {
          setPlayers(prev =>
            prev.map(p =>
              p.id === payload.new.id ? { ...p, ...payload.new } : p
            )
          )
        }
      )

      // AUCTION STATE
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "auction_state" },
        fetchAuctionState
      )

      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const getRemainingSlots = (teamId, maxPlayers) => {
    const count = players.filter(p => p.team_id === teamId).length
    return maxPlayers ? maxPlayers - count : '--'
  }

  const getPlayerCount = (teamId) => {
    return players.filter(p => p.team_id === teamId).length
  }

  return (
    <div className="min-h-screen relative text-white p-6 overflow-hidden">

      {/* BACKGROUND */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0b0f2a] via-[#111633] to-black"></div>

      <div className="relative z-10">

        {/* HEADER */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold tracking-widest text-yellow-400 animate-pulse">
            🏏 LIVE AUCTION
          </h1>
        </div>

        {/* AUCTION AREA */}
        <div className="bg-[#0e1435] rounded-xl p-6 shadow-lg mb-6">

          <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-3">
            <p className="text-sm text-gray-400">AUCTION STATUS</p>
            <p className={`font-bold ${auctionState?.status === "running" || auctionState?.status === "live" ? "text-green-400" : "text-gray-400"}`}>
              ● {auctionState?.status?.toUpperCase() || "IDLE"}
            </p>
          </div>

          <div className="flex flex-col items-center text-center">

            {players.find(p => p.id === auctionState?.current_player) ? (
              <>
                <img
                  src={players.find(p => p.id === auctionState.current_player)?.image}
                  onClick={() => setFullscreenImage(players.find(p => p.id === auctionState.current_player)?.image)}
                  className="w-48 h-48 rounded-full object-cover mb-4 border-4 border-yellow-400 cursor-pointer"
                />

                <h2 className="text-3xl font-bold mb-2">
                  {players.find(p => p.id === auctionState.current_player)?.name}
                </h2>

                <p className="text-sm text-gray-400 mb-4">
                  {players.find(p => p.id === auctionState.current_player)?.role}
                </p>
              </>
            ) : (
              <>
                <div className="w-48 h-48 rounded-full bg-gray-800 flex items-center justify-center mb-4 border-4 border-yellow-400">
                  <span className="text-gray-500">Player</span>
                </div>
                <h2 className="text-3xl font-bold mb-2">Waiting for Player</h2>
              </>
            )}

            <div className="bg-black px-8 py-4 rounded-lg border border-yellow-400 shadow-lg">
              <p className="text-gray-400 text-sm">CURRENT BID</p>
              <p className={`text-yellow-400 text-4xl font-bold transition ${
                bidFlash ? "scale-110 text-green-400" : ""
              }`}>
                ₹{auctionState?.current_bid || 0}
              </p>
            </div>

          </div>

          <div className="mt-8 text-center">
            <p className="text-gray-400 text-sm">Current Bidder</p>
            <p className="text-xl font-semibold text-green-400">
              {teams.find(t => t.id === auctionState?.highest_team)?.name || "--"}
            </p>
          </div>

        </div>

        {/* TOGGLE */}
        <div className="flex justify-center gap-4 mb-6">

          <button
            onClick={() => setView("overview")}
            className={`px-4 py-2 rounded ${view==="overview" ? "bg-yellow-400 text-black" : "bg-gray-700"}`}
          >
            Teams
          </button>

          <button
            onClick={() => setView("players")}
            className={`px-4 py-2 rounded ${view==="players" ? "bg-yellow-400 text-black" : "bg-gray-700"}`}
          >
            Players
          </button>

          <button
            onClick={() => setView("teams")}
            className={`px-4 py-2 rounded ${view==="teams" ? "bg-yellow-400 text-black" : "bg-gray-700"}`}
          >
            Team Squads
          </button>

        </div>

        {/* TEAMS */}
        {view === "overview" && (
          <div className="bg-transparent rounded-xl p-2">

            <h2 className="text-lg font-semibold mb-4 text-yellow-300 text-center">
              Teams
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 justify-items-center">
              {teams.map((team, index) => {
                const teamColors = [
                  "from-yellow-500 to-yellow-700",
                  "from-red-600 to-red-800",
                  "from-blue-600 to-blue-800",
                  "from-green-600 to-green-800",
                  "from-purple-600 to-purple-800",
                  "from-pink-600 to-pink-800",
                  "from-orange-500 to-orange-700",
                  "from-cyan-500 to-cyan-700"
                ];

                const color = teamColors[index % teamColors.length];

                return (
                  <div
                    key={team.id}
                    onClick={() => {
                      setSelectedTeam(team)
                      setView("teams")
                    }}
                    className={`relative w-full max-w-[220px] h-64 md:h-72 rounded-xl overflow-hidden group shadow-lg bg-gradient-to-br ${color} cursor-pointer 
  ${team.id === activeTeamId ? 'ring-4 ring-yellow-400 scale-105 shadow-[0_0_25px_rgba(255,215,0,0.8)] animate-pulse' : ''}`}
                  >

                    {/* Pattern Overlay */}
                    <div className="absolute inset-0 bg-[url('https://www.iplt20.com/assets/images/back-bg-csk.png')] bg-cover opacity-20"></div>

                    {/* Dark Overlay */}
                    <div className="absolute inset-0 bg-black/30"></div>

                    {team.id === activeTeamId && (
                      <div className="absolute top-2 right-2 bg-yellow-400 text-black text-[10px] px-2 py-1 rounded-full font-bold animate-pulse">
                        LIVE
                      </div>
                    )}

                    {/* Content */}
                    <div className="relative z-10 flex flex-col items-center justify-between h-full px-2 py-3">

                      {/* Logo */}
                      {team.logo_url && (
                        <img
                          src={team.logo_url}
                          alt={team.name}
                          className="w-20 h-20 md:w-24 md:h-24 object-contain drop-shadow-xl"
                        />
                      )}

                      {/* Team Name */}
                      <p className="text-[11px] text-white text-center font-semibold leading-tight">
                        {team.name}
                      </p>

                      {/* Info Blocks */}
                      <div className="w-full mt-3 space-y-2">

                        {/* Funds - Full Width */}
                        <div className="bg-black/40 text-center py-2 rounded border border-white/20">
                          <p className="text-[10px] text-gray-300">Funds Remaining</p>
                          <p className="text-green-300 text-base font-bold">
                            ₹{team.purse_remaining}
                          </p>
                        </div>

                        {/* Players + Slots Row */}
                        <div className="grid grid-cols-2 gap-2">

                          {/* Players */}
                          <div className="bg-black/40 text-center py-2 rounded border border-white/20">
                            <p className="text-[10px] text-gray-300">Players</p>
                            <p className="text-blue-300 text-sm font-bold">
                              {getPlayerCount(team.id)}
                            </p>
                          </div>

                          {/* Slots Left */}
                          <div className="bg-black/40 text-center py-2 rounded border border-white/20">
                            <p className="text-[10px] text-gray-300">Slots Left</p>
                            <p className="text-yellow-300 text-sm font-bold">
                              {getRemainingSlots(team.id, team.max_players)}
                            </p>
                          </div>

                        </div>

                      </div>

                    </div>

                  </div>
                )
              })}
            </div>

          </div>
        )}

        {view === "players" && (
          <>
            {/* SEARCH + FILTERS */}
            <div className="flex flex-col md:flex-row gap-3 mb-4">
              <input
                type="text"
                placeholder="Search player..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-3 py-2 rounded bg-[#111633] border border-gray-600 text-white w-full md:w-1/3"
              />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 rounded bg-[#111633] border border-gray-600 text-white"
              >
                <option value="all">All Roles</option>
                <option value="Batsman">Batsman</option>
                <option value="Bowler">Bowler</option>
                <option value="Allrounder">Allrounder</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded bg-[#111633] border border-gray-600 text-white"
              >
                <option value="all">All Status</option>
                <option value="available">Available</option>
                <option value="unsold">Unsold</option>
                <option value="sold">Sold</option>
              </select>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {players
                .filter(p => {
                  const matchesSearch =
                    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    String(p.player_number || "").includes(searchTerm)
                  const matchesRole = roleFilter === "all" || p.role?.toLowerCase() === roleFilter.toLowerCase()
                  const matchesStatus = statusFilter === "all" || p.status === statusFilter
                  return matchesSearch && matchesRole && matchesStatus
                })
                .sort((a, b) => (a.player_number || 0) - (b.player_number || 0))
                .map(player => (
                  <div
                    key={player.id}
                    className={`relative p-3 rounded-xl text-center transition ${
                      (
                        (searchTerm &&
                          (player.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            String(player.player_number || "").includes(searchTerm))) ||
                        player.id === auctionState?.current_player
                      )
                        ? "bg-yellow-500/20 ring-2 ring-yellow-400 scale-105 shadow-[0_0_25px_rgba(255,215,0,0.8)]"
                        : "bg-[#111633]"
                    }`}
                  >
                    {/* STATUS BADGE */}
                    <div className="absolute top-2 left-2">
                      {player.is_retained ? (
                        <span className="text-[10px] px-2 py-1 rounded bg-yellow-400 text-black font-bold">ICON</span>
                      ) : player.status === "sold" ? (
                        <span className="text-[10px] px-2 py-1 rounded bg-red-500 text-white font-bold animate-pulse">SOLD</span>
                      ) : (
                        <span className="text-[10px] px-2 py-1 rounded bg-green-500 text-white font-bold">AVAILABLE</span>
                      )}
                    </div>
                    {/* 6) Add LIVE badge for current player */}
                    {player.id === auctionState?.current_player && (
                      <div className="absolute top-2 right-2 bg-green-400 text-black text-[10px] px-2 py-1 rounded font-bold animate-pulse">
                        LIVE
                      </div>
                    )}
                    <img
                      src={player.image}
                      className="w-20 h-20 mx-auto rounded-full object-cover mb-2 cursor-pointer"
                      onClick={() => setFullscreenImage(player.image)}
                    />
                    <p className="text-sm font-bold">{player.name}</p>
                    <p className="text-xs text-gray-400">{player.role}</p>
                    <p className="text-sm font-bold text-yellow-300 bg-black/40 px-2 py-1 rounded-full inline-block mt-1">
                      #{player.player_number}
                    </p>
                    {/* 7) Show bid price for SOLD players */}
                    {player.status === "sold" && (
                      <p className="text-xs text-green-400 font-bold mt-1">
                        ₹{player.sold_price}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          </>
        )}

        {view === "teams" && (
          <div className="space-y-6">
            {/* TEAM LOGO STACK */}
            <div className="flex justify-center gap-3 mb-6 flex-wrap">
              {teams.map(team => (
                <img
                  key={team.id}
                  src={team.logo_url}
                  onClick={() => setSelectedTeam(team)}
                  className="w-12 h-12 rounded-full border-2 border-white cursor-pointer hover:scale-110 transition"
                />
              ))}
            </div>
            {(selectedTeam ? [selectedTeam] : teams).map(team => (
              <div key={team.id}>

                <div className="bg-[#111633] rounded-xl p-6 mb-4 flex flex-col items-center">

                  {/* Team Logo (TOP CENTER BIG) */}
                  {team.logo_url && (
                    <img
                      src={team.logo_url}
                      className="w-28 h-28 md:w-32 md:h-32 object-contain mb-4 drop-shadow-[0_0_20px_rgba(255,255,255,0.6)]"
                    />
                  )}

                  {/* Team Name */}
                  <h3 className="text-2xl font-bold text-yellow-300 mb-3 text-center">
                    {team.name}
                  </h3>

                  {/* Owner Name */}
                  {team.owner_name && (
                    <p className="text-sm font-semibold text-yellow-400 bg-black/40 px-3 py-1 rounded-full mb-3">
                      {team.owner_name}
                    </p>
                  )}

                  {/* Owner Photo (CENTER BELOW LOGO) */}
                  {team.owner_photo_url && (
                    <div className="flex flex-col items-center mb-4">
                      <img
                        src={team.owner_photo_url}
                        onClick={() => setFullscreenImage(team.owner_photo_url)}
                        className="w-20 h-20 md:w-24 md:h-24 rounded-xl border-4 border-yellow-400 shadow-[0_0_25px_rgba(255,215,0,0.8)] cursor-pointer"
                      />
                      <p className="text-xs mt-2 text-gray-300">Owner</p>
                    </div>
                  )}

                  {/* Slots Info */}
                  <div className="flex gap-6 text-center">

                    <div>
                      <p className="text-xs text-gray-400">Players</p>
                      <p className="text-lg font-bold text-blue-300">
                        {getPlayerCount(team.id)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-400">Slots Left</p>
                      <p className="text-lg font-bold text-green-400">
                        {getRemainingSlots(team.id, team.max_players)}
                      </p>
                    </div>

                  </div>

                </div>

                {/* ICON PLAYER HERO SPOTLIGHT */}
                {players
                  .filter(p => p.team_id === team.id && (p.is_retained === true || p.is_retained === "true"))
                  .map(player => (
                    <div
                      key={`icon-${player.id}`}
                      className="w-full mb-4 flex flex-col items-center justify-center text-center p-4 rounded-2xl 
                      bg-gradient-to-b from-[#111633] via-[#0b0f2a] to-black 
                      border-2 border-yellow-400 shadow-[0_0_40px_rgba(255,215,0,0.7)] relative overflow-hidden"
                    >

                      {/* Glow Background */}
                      <div className="absolute inset-0 bg-yellow-400/10 blur-2xl"></div>

                      {/* Player Image */}
                      <img
                        src={player.image}
                        className="w-24 h-24 rounded-full object-cover border-4 border-yellow-400 shadow-[0_0_20px_rgba(255,215,0,0.8)] mb-3 relative z-10"
                      />

                      {/* Label */}
                      <p className="text-xs text-yellow-400 tracking-widest uppercase mb-0.5 relative z-10">
                        ★ Icon Player
                      </p>

                      {/* Name */}
                      <h2 className="text-xl md:text-2xl font-bold text-white relative z-10">
                        {player.name}
                      </h2>

                      {/* Role */}
                      <p className="text-sm text-gray-400 mt-1 relative z-10">
                        {player.role}
                      </p>

                    </div>
                ))}

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {players
                    .filter(p => p.team_id === team.id && !(p.is_retained === true || p.is_retained === "true"))
                    .map(player => (
                      <div
                        key={player.id}
                        className="relative rounded-xl overflow-hidden text-center p-3 bg-[#111633]"
                      >
                        <img
                          src={player.image}
                          className={`mx-auto rounded-lg object-cover mb-2 ${
                            player.is_retained ? "w-24 h-24 border-2 border-black shadow-lg" : "w-20 h-20"
                          }`}
                        />
                        <p className="text-sm font-semibold">{player.name}</p>
                        <p className="text-xs text-gray-400">{player.role}</p>
                        {player.status === "sold" && (
                          <p className="text-sm text-green-400 font-bold mt-1">₹{player.sold_price}</p>
                        )}
                      </div>
                    ))}
                </div>

              </div>
            ))}
          </div>
        )}

      </div>

      {fullscreenImage && (
        <div 
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50"
          onClick={() => setFullscreenImage(null)}
        >
          <img 
            src={fullscreenImage} 
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}

    </div>
  )
}