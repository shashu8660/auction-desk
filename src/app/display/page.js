"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export default function DisplayPage() {
  const [teams, setTeams] = useState([])
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [teamSquad, setTeamSquad] = useState([])

  const [previewImage, setPreviewImage] = useState(null)

  // Team map and match schedules
  const teamMap = {
    1: "Karkada Royals Nellibettu",
    2: "Pari Friends Badaholi",
    3: "Ajay Cricket club Kunjigudi",
    4: "Black Panthers Karakadas",
    5: "SS Super Kings",
    6: "Aparna Eleven Cricket",
    7: "SD Cricketers Karkada",
    8: "Girija Road Lines Attackers"
  }

  const poolAMatches = [
    { t1: 1, t2: 2, time: "8:30 AM" },
    { t1: 3, t2: 4, time: "9:30 AM" },
    { t1: 1, t2: 3, time: "10:30 AM" },
    { t1: 2, t2: 4, time: "11:30 AM" },
    { t1: 1, t2: 4, time: "12:30 PM" },
    { t1: 2, t2: 3, time: "1:30 PM" }
  ]

  const poolBMatches = [
    { t1: 5, t2: 6, time: "7:30 AM" },
    { t1: 7, t2: 8, time: "8:30 AM" },
    { t1: 5, t2: 7, time: "9:30 AM" },
    { t1: 6, t2: 8, time: "10:30 AM" },
    { t1: 5, t2: 8, time: "11:30 AM" },
    { t1: 6, t2: 7, time: "12:30 PM" }
  ]

  const semiFinalMatches = [
    { label: "Pool A - TOP 2 Teams"},
    { label: "Pool B - TOP 2 Teams"}
  ]

  const finalMatch = {
    label: "WINNER SEMI 1",
    vs: "WINNER SEMI 2"
  }

  const fetchData = async () => {
    const { data: teamsData } = await supabase
      .from("teams")
      .select("*")

    setTeams(teamsData || [])
  }

  const fetchTeamSquad = async (teamId) => {
    const { data } = await supabase
      .from("players")
      .select("*")
      .eq("team_id", teamId)
      .in("status", ["sold", "retained"])
      .order("sold_price", { ascending: false })

    setTeamSquad(data || [])
  }

  useEffect(() => {
    fetchData()

    const channel = supabase
      .channel("auction-display")
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

  return (
    <div className="min-h-screen bg-black text-white p-4">

      <h1 className="text-3xl font-bold text-center mb-6">
        🏆 TEAM SQUADS
      </h1>

      {/* Pool A */}
      <div className="mb-4">
        <div className="bg-gradient-to-r from-yellow-600 to-yellow-400 text-black text-center py-2 rounded-lg font-bold tracking-widest shadow-lg">
          🅰️ POOL A
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-8">
        {teams
          .filter(team =>
            [
              "Pari Friends Badaholi",
              "Black Panthers Karakadas",
              "Karkada Royals Nellibettu",
              "Ajay Cricket club Kunjigudi"
            ].includes(team.name)
          )
          .map(team => (
            <div
              key={team.id}
              onClick={() => {
                if (selectedTeam?.id === team.id) {
                  setSelectedTeam(null)
                  setTeamSquad([])
                } else {
                  setSelectedTeam(team)
                  fetchTeamSquad(team.id)
                }
              }}
              className="bg-gray-900 p-4 rounded-xl border border-yellow-500 text-center hover:bg-yellow-500/10 transition-all duration-300"
            >
              {team.logo_url && (
                <img
                  src={team.logo_url}
                  alt={team.name}
                  className="h-12 mx-auto mb-2"
                />
              )}
              <p className="font-semibold text-sm">{team.name}</p>
            </div>
          ))}
      </div>

      {/* Pool B */}
      <div className="mb-4 mt-6">
        <div className="bg-gradient-to-r from-blue-600 to-blue-400 text-white text-center py-2 rounded-lg font-bold tracking-widest shadow-lg">
          🅱️ POOL B
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-8">
        {teams
          .filter(team =>
            [
              "Aparna Eleven Cricket",
              "SS Super Kings",
              "SD Cricketers Karkada",
              "Girija Road Lines Attackers"
            ].includes(team.name)
          )
          .map(team => (
            <div
              key={team.id}
              onClick={() => {
                if (selectedTeam?.id === team.id) {
                  setSelectedTeam(null)
                  setTeamSquad([])
                } else {
                  setSelectedTeam(team)
                  fetchTeamSquad(team.id)
                }
              }}
              className="bg-gray-900 p-4 rounded-xl border border-blue-500 text-center hover:bg-blue-500/10 transition-all duration-300"
            >
              {team.logo_url && (
                <img
                  src={team.logo_url}
                  alt={team.name}
                  className="h-12 mx-auto mb-2"
                />
              )}
              <p className="font-semibold text-sm">{team.name}</p>
            </div>
          ))}
      </div>

      {/* MATCH SCHEDULE */}

      <div className="mt-12">

        <h2 className="text-3xl font-bold text-center mb-8 tracking-wide">
          🏏 TOURNAMENT FIXTURES
        </h2>

      {/* Pool A Section */}
      <div className="mb-10">

        <div className="bg-gradient-to-r from-yellow-600 to-yellow-400 text-black text-center py-3 rounded-lg font-bold tracking-widest shadow-lg mb-4">
          <div>🅰️ POOL A FIXTURES</div>
          <div className="mt-1">
            <span className="bg-black text-yellow-300 px-3 py-1 rounded text-sm">
              SATURDAY • 14 MARCH
            </span>
          </div>
        </div>

        <div className="grid gap-4">
          {poolAMatches.map((match, i) => (
            <div
              key={i}
              className="bg-gray-900 border border-yellow-500 rounded-xl p-4 flex items-center justify-between shadow-md"
            >

              <div className="text-left w-5/12">
                <p className="text-sm font-semibold uppercase">
                  {teamMap[match.t1]}
                </p>
              </div>

              <div className="text-center w-2/12">
                <p className="text-yellow-400 font-bold text-sm">MATCH {i + 1}</p>
                {/* Highlighted match time for Pool A fixtures */}
                {/* <p className="text-xs text-gray-400">{match.time}</p> */}
                <p className="text-sm font-bold bg-yellow-400 text-black px-3 py-[3px] rounded shadow">{match.time}</p>
                <p className="text-lg font-bold">VS</p>
              </div>

              <div className="text-right w-5/12">
                <p className="text-sm font-semibold uppercase">
                  {teamMap[match.t2]}
                </p>
              </div>

            </div>
          ))}
        </div>

      </div>

        {/* Pool B Section */}
        <div>

          <div className="bg-gradient-to-r from-blue-600 to-blue-400 text-white text-center py-3 rounded-lg font-bold tracking-widest shadow-lg mb-4">
            <div>🅱️ POOL B FIXTURES</div>
            <div className="mt-1">
              <span className="bg-white text-blue-700 px-3 py-1 rounded text-sm">
                SUNDAY • 15 MARCH
              </span>
            </div>
          </div>

          <div className="grid gap-4">
            {poolBMatches.map((match, i) => (
              <div
                key={i}
                className="bg-gray-900 border border-blue-500 rounded-xl p-4 flex items-center justify-between shadow-md"
              >

                <div className="text-left w-5/12">
                  <p className="text-sm font-semibold uppercase">
                    {teamMap[match.t1]}
                  </p>
                </div>

                <div className="text-center w-2/12">
                  <p className="text-blue-400 font-bold text-sm">MATCH {i + 1}</p>
                  {/* Highlighted match time for Pool B fixtures */}
                  {/* <p className="text-xs text-gray-400">{match.time}</p> */}
                  <p className="text-sm font-bold bg-blue-500 text-white px-3 py-[3px] rounded shadow">{match.time}</p>
                  <p className="text-lg font-bold">VS</p>
                </div>

                <div className="text-right w-5/12">
                  <p className="text-sm font-semibold uppercase">
                    {teamMap[match.t2]}
                  </p>
                </div>

              </div>
            ))}
          </div>

        </div>

      </div>

      {/* SEMI FINALS */}
      <div className="mt-12">

        <div className="bg-gradient-to-r from-purple-600 to-pink-500 text-white text-center py-2 rounded-lg font-bold tracking-widest shadow-lg mb-4">
          🏆 SEMI FINALS • <span className="bg-yellow-400 text-black px-2 py-1 rounded">LOTS</span>
        </div>
        <div className="text-center text-sm text-yellow-300 mb-4 font-semibold">
          (TOP 4 TEAMS LOTS)
        </div>

        <div className="grid gap-4">
          {semiFinalMatches.map((match, i) => (
            <div
              key={i}
              className="bg-gray-900 border border-purple-500 rounded-xl p-4 flex items-center justify-center shadow-md"
            >
              <div className="text-center">
                <p className="text-purple-400 font-bold text-sm mb-1">SEMI {i + 1}</p>
                <p className="text-sm font-semibold uppercase">
                  {match.label}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* FINAL */}
      <div className="mt-12">

        <div className="bg-gradient-to-r from-red-600 to-yellow-500 text-white text-center py-2 rounded-lg font-bold tracking-widest shadow-lg mb-4">
          🏆 GRAND FINAL
        </div>

        <div className="bg-gray-900 border border-yellow-500 rounded-xl p-4 flex items-center justify-between shadow-md">

          <div className="text-left w-5/12">
            <p className="text-sm font-semibold uppercase">
              {finalMatch.label}
            </p>
          </div>

          <div className="text-center w-2/12">
            <p className="text-yellow-400 font-bold text-sm">FINAL</p>
            <p className="text-lg font-bold">VS</p>
          </div>

          <div className="text-right w-5/12">
            <p className="text-sm font-semibold uppercase">
              {finalMatch.vs}
            </p>
          </div>

        </div>

      </div>

      {/* Selected Team Squad Popup */}
      {selectedTeam && (
        <div className="fixed inset-0 bg-black/95 p-4 overflow-y-auto z-50">

          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold px-4 py-1 rounded-lg bg-gradient-to-r from-yellow-500 to-yellow-400 text-black shadow-lg">
              {selectedTeam.name}
            </h2>
            <button
              onClick={() => {
                setSelectedTeam(null)
                setTeamSquad([])
              }}
              className="text-red-400 font-bold"
            >Close</button>
          </div>

          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg p-3 mb-3 border border-yellow-500 shadow-md">

            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">

              {/* Owner Section */}
              <div className="flex items-center gap-4">
                {selectedTeam.owner_photo_url && (
                  <img
                    src={selectedTeam.owner_photo_url}
                    onClick={() => setPreviewImage(selectedTeam.owner_photo_url)}
                    className="w-20 h-20 rounded-full object-cover border-2 border-yellow-400 cursor-pointer hover:scale-105 transition"
                  />
                )}
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Owner</p>
                  <p className="text-lg font-semibold">{selectedTeam.owner_name}</p>
                </div>
              </div>

              {/* Retained Players Right Side */}
              <div className="w-full md:w-auto">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2 text-center md:text-left">
                  Retained Players
                </p>

                <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                  {teamSquad
                    .filter(p => p.status === "retained")
                    .map(p => (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 bg-gray-800 border border-yellow-400 px-3 py-2 rounded-lg text-xs shadow-sm"
                      >
                        {p.image && (
                          <img
                            src={p.image}
                            onClick={() => setPreviewImage(p.image)}
                            className="w-16 h-16 rounded-full object-cover border-2 border-yellow-400 cursor-pointer hover:scale-105 transition"
                          />
                        )}
                        <div>
                          <p className="text-sm font-semibold text-white">{p.name}</p>
                          <p className="text-xs text-yellow-400 font-semibold">₹{p.sold_price}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

            </div>

          </div>

          <div className="mt-6">
            <div className="grid grid-cols-4 gap-3">
              {teamSquad.filter(p => p.status !== "retained").map(player => {
                const isRetained = player.status === "retained"

                return (
                  <div
                    key={player.id}
                    className={`rounded-xl p-2 text-center transition-all duration-300
                      ${isRetained
                        ? "bg-yellow-500 text-black"
                        : "bg-gray-900 border border-gray-700"
                      }
                    `}
                  >
                    {player.image && (
                      <img
                        src={player.image}
                        alt={player.name}
                        onClick={() => setPreviewImage(player.image)}
                        className={`w-16 h-16 mx-auto rounded-lg object-cover mb-2 cursor-pointer transition-transform duration-200 hover:scale-105
                          ${isRetained ? "border-4 border-white" : "border border-gray-700"}`}
                      />
                    )}

                    <p className="font-semibold text-[11px] leading-tight uppercase">
                      {player.name}
                    </p>

                    <p className={`text-[10px] mt-1 ${isRetained ? "text-black/80" : "text-gray-400"}`}>
                      ₹{player.sold_price}
                    </p>

                    {isRetained && (
                      <div className="mt-1 text-[9px] font-bold bg-black text-yellow-400 px-2 py-[2px] rounded-full inline-block">
                        RETAINED
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      )}

      {previewImage && (
        <div
          className="fixed inset-0 bg-black/95 flex items-center justify-center z-[9999] p-4"
          onClick={() => setPreviewImage(null)}
        >
          <img
            src={previewImage}
            alt="Preview"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[95vh] max-w-[95vw] rounded-2xl shadow-2xl"
          />
        </div>
      )}

    </div>
  )
}