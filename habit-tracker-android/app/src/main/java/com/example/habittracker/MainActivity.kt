package com.example.habittracker

import android.annotation.SuppressLint
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.WebResourceRequest
import android.webkit.WebResourceError
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebSettings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView

class MainActivity : ComponentActivity() {

    private val appUrl = "http://54.91.207.131/"

    private val offlinePage = """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Evolvio - Offline</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    background: linear-gradient(135deg, #0a0f1e 0%, #111827 100%);
                    color: #fff;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    padding: 24px;
                    text-align: center;
                }
                .icon {
                    font-size: 80px;
                    margin-bottom: 24px;
                    animation: pulse 2s infinite;
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                h1 {
                    font-size: 28px;
                    font-weight: 800;
                    background: linear-gradient(90deg, #60a5fa, #a78bfa);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    margin-bottom: 12px;
                }
                p {
                    color: #9ca3af;
                    font-size: 15px;
                    line-height: 1.6;
                    max-width: 280px;
                    margin-bottom: 32px;
                }
                .btn {
                    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
                    color: #fff;
                    border: none;
                    padding: 14px 32px;
                    border-radius: 50px;
                    font-size: 16px;
                    font-weight: 700;
                    cursor: pointer;
                    box-shadow: 0 4px 24px rgba(59, 130, 246, 0.4);
                    transition: transform 0.2s;
                }
                .btn:active { transform: scale(0.97); }
                .badge {
                    margin-top: 40px;
                    font-size: 12px;
                    color: #4b5563;
                    letter-spacing: 0.05em;
                }
            </style>
        </head>
        <body>
            <div class="icon">📡</div>
            <h1>You're Offline</h1>
            <p>No internet connection detected. Please check your Wi-Fi or mobile data and try again.</p>
            <button class="btn" onclick="window.location.reload()">Try Again</button>
            <div class="badge">EVOLVIO · Previously cached content may still be available</div>
        </body>
        </html>
    """.trimIndent()

    private fun isOnline(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                AndroidView(
                    factory = { context ->
                        WebView(context).apply {
                            layoutParams = ViewGroup.LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT,
                                ViewGroup.LayoutParams.MATCH_PARENT
                            )

                            // Enable caching
                            settings.apply {
                                javaScriptEnabled = true
                                domStorageEnabled = true
                                databaseEnabled = true
                                cacheMode = WebSettings.LOAD_CACHE_ELSE_NETWORK
                                allowFileAccess = true
                            }

                            webViewClient = object : WebViewClient() {
                                override fun onReceivedError(
                                    view: WebView,
                                    request: WebResourceRequest,
                                    error: WebResourceError
                                ) {
                                    if (request.isForMainFrame) {
                                        view.loadDataWithBaseURL(
                                            null,
                                            offlinePage,
                                            "text/html",
                                            "UTF-8",
                                            null
                                        )
                                    }
                                }
                            }

                            if (isOnline()) {
                                loadUrl(appUrl)
                            } else {
                                loadDataWithBaseURL(null, offlinePage, "text/html", "UTF-8", null)
                            }
                        }
                    },
                    update = { }
                )
            }
        }
    }
}
